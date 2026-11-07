// Lab 05 Ex 3 - bounded queue with split locks (Herlihy & Shavit's BoundedQueue).
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

typedef struct node { int value; struct node *next; } node_t;
typedef struct {
    node_t *head, *tail;
    pthread_mutex_t enqLock, deqLock;
    pthread_cond_t notFull, notEmpty;
    volatile int permits;               // free slots; changed atomically by both sides
    int capacity;
} bounded_queue_t;

void queue_init(bounded_queue_t *q, int cap) {
    node_t *s = malloc(sizeof(node_t));
    s->value = -1; s->next = NULL;
    q->head = q->tail = s;              // sentinel: head->next is the first real item
    q->capacity = q->permits = cap;
    pthread_mutex_init(&q->enqLock, NULL); pthread_mutex_init(&q->deqLock, NULL);
    pthread_cond_init(&q->notFull, NULL); pthread_cond_init(&q->notEmpty, NULL);
}

void queue_enq(bounded_queue_t *q, int value) {
    int wake_deq = 0;
    node_t *n = malloc(sizeof(node_t));
    n->value = value; n->next = NULL;
    pthread_mutex_lock(&q->enqLock);
    while (q->permits == 0)                          // full
        pthread_cond_wait(&q->notFull, &q->enqLock);
    q->tail->next = n;                               // only enqueuers touch tail
    q->tail = n;
    if (__sync_fetch_and_sub(&q->permits, 1) == q->capacity)
        wake_deq = 1;                                // queue WAS empty: dequeuers may sleep
    pthread_mutex_unlock(&q->enqLock);
    if (wake_deq) {                                  // signal under the OTHER side's lock,
        pthread_mutex_lock(&q->deqLock);             // so a dequeuer between "is empty?"
        pthread_cond_broadcast(&q->notEmpty);        // and wait() cannot miss it
        pthread_mutex_unlock(&q->deqLock);
    }
}

int queue_deq(bounded_queue_t *q) {
    int wake_enq = 0;
    pthread_mutex_lock(&q->deqLock);
    while (q->head->next == NULL)                    // empty (head == tail)
        pthread_cond_wait(&q->notEmpty, &q->deqLock);
    node_t *old = q->head;
    int value = old->next->value;
    q->head = old->next;                             // first node becomes the new sentinel
    free(old);
    if (__sync_fetch_and_add(&q->permits, 1) == 0)
        wake_enq = 1;                                // queue WAS full: enqueuers may sleep
    pthread_mutex_unlock(&q->deqLock);
    if (wake_enq) {
        pthread_mutex_lock(&q->enqLock);
        pthread_cond_broadcast(&q->notFull);
        pthread_mutex_unlock(&q->enqLock);
    }
    return value;
}

// ---- Test harness (provided, unchanged) ------------------------------------
#ifndef ITEMS_PER_PRODUCER
#define ITEMS_PER_PRODUCER 10000
#endif
typedef struct { bounded_queue_t *q; int id; } targ_t;
void *producer(void *arg) {
    targ_t *ta = arg;
    for (int i = 0; i < ITEMS_PER_PRODUCER; i++) queue_enq(ta->q, ta->id * 100000 + i);
    return NULL;
}
long consumer_sum = 0; int consumer_count = 0;
pthread_mutex_t sum_lock = PTHREAD_MUTEX_INITIALIZER;
void *consumer(void *arg) {
    targ_t *ta = arg;
    while (1) {
        int val = queue_deq(ta->q);
        if (val == -999) break;
        pthread_mutex_lock(&sum_lock); consumer_sum += val; consumer_count++;
        pthread_mutex_unlock(&sum_lock);
    }
    return NULL;
}
void run_test(int np, int nc, int cap) {
    bounded_queue_t q;
    queue_init(&q, cap);
    consumer_sum = 0; consumer_count = 0;
    pthread_t prods[np], cons[nc];
    targ_t pargs[np], cargs[nc];
    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);
    for (int i = 0; i < nc; i++) { cargs[i] = (targ_t){&q, i}; pthread_create(&cons[i], NULL, consumer, &cargs[i]); }
    for (int i = 0; i < np; i++) { pargs[i] = (targ_t){&q, i}; pthread_create(&prods[i], NULL, producer, &pargs[i]); }
    for (int i = 0; i < np; i++) pthread_join(prods[i], NULL);
    for (int i = 0; i < nc; i++) queue_enq(&q, -999);
    for (int i = 0; i < nc; i++) pthread_join(cons[i], NULL);
    clock_gettime(CLOCK_MONOTONIC, &end);
    double elapsed = (end.tv_sec - start.tv_sec) + (end.tv_nsec - start.tv_nsec) / 1e9;
    int expected = np * ITEMS_PER_PRODUCER;
    printf("%dP/%dC cap=%d: %.4fs, items=%d/%d %s\n", np, nc, cap, elapsed,
           consumer_count, expected, consumer_count == expected ? "OK" : "WRONG");
}
int main(void) {
    printf("--- Split-Lock Queue Tests ---\n");
    run_test(1, 1, 10); run_test(2, 2, 10); run_test(4, 4, 10); run_test(4, 4, 100);
    return 0;
}
