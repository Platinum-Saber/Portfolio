// Lab 06 Ex 3 - three-stage pipeline over bounded queues; replicate the slow stage.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <math.h>
#include <time.h>

typedef struct qnode { int val; struct qnode *next; } qn_t;
typedef struct { qn_t *head, *tail; pthread_mutex_t lock;
                 pthread_cond_t not_full, not_empty; int count, cap; } queue_t;
void q_init(queue_t *q, int cap) {
    qn_t *s = malloc(sizeof(qn_t)); s->val = -1; s->next = NULL;
    q->head = q->tail = s; q->count = 0; q->cap = cap;
    pthread_mutex_init(&q->lock, NULL);
    pthread_cond_init(&q->not_full, NULL); pthread_cond_init(&q->not_empty, NULL);
}
void q_enq(queue_t *q, int v) {
    qn_t *n = malloc(sizeof(qn_t)); n->val = v; n->next = NULL;
    pthread_mutex_lock(&q->lock);
    while (q->count >= q->cap) pthread_cond_wait(&q->not_full, &q->lock);
    q->tail->next = n; q->tail = n; q->count++;
    pthread_cond_signal(&q->not_empty);
    pthread_mutex_unlock(&q->lock);
}
int q_deq(queue_t *q) {
    pthread_mutex_lock(&q->lock);
    while (q->count == 0) pthread_cond_wait(&q->not_empty, &q->lock);
    qn_t *old = q->head; q->head = old->next;
    int v = q->head->val; q->count--;
    free(old);
    pthread_cond_signal(&q->not_full);
    pthread_mutex_unlock(&q->lock);
    return v;
}

#ifndef NUM_ITEMS
#define NUM_ITEMS 5000
#endif
#define POISON -999
int stage1_generate(int id) { return id * 3 + 7; }
int stage2_process(int data) {
    double r = data;
    for (int i = 0; i < 5000; i++) r = sin(r) * cos(r) + 1.0;
    return (int)r + data;
}
int stage3_finalize(int data) { return data % 10000; }

queue_t q12, q23;
int n_stage2;                  // replicas of the bottleneck stage
long checksum;

void *stage1_thread(void *arg) {
    (void)arg;
    for (int i = 0; i < NUM_ITEMS; i++) q_enq(&q12, stage1_generate(i));
    for (int k = 0; k < n_stage2; k++) q_enq(&q12, POISON);    // one pill per stage-2 worker
    return NULL;
}
void *stage2_thread(void *arg) {
    (void)arg;
    for (;;) {
        int d = q_deq(&q12);
        if (d == POISON) { q_enq(&q23, POISON); break; }      // forward the pill
        q_enq(&q23, stage2_process(d));
    }
    return NULL;
}
void *stage3_thread(void *arg) {
    (void)arg;
    long sum = 0;
    int pills = 0;
    while (pills < n_stage2) {                 // stop only after EVERY stage-2 worker is done
        int d = q_deq(&q23);
        if (d == POISON) pills++;
        else sum += stage3_finalize(d);
    }
    checksum = sum;                            // a sum: arrival order does not matter
    return NULL;
}

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec / 1e9; }

int main(void) {
    double t = now();
    long serial = 0;
    for (int i = 0; i < NUM_ITEMS; i++) serial += stage3_finalize(stage2_process(stage1_generate(i)));
    double ts = now() - t;
    printf("Serial: %.4fs checksum %ld\n", ts, serial);
    for (n_stage2 = 1; n_stage2 <= 3; n_stage2++) {
        q_init(&q12, 16); q_init(&q23, 16);
        pthread_t s1, s2[n_stage2], s3;
        t = now();
        pthread_create(&s1, NULL, stage1_thread, NULL);
        for (int k = 0; k < n_stage2; k++) pthread_create(&s2[k], NULL, stage2_thread, NULL);
        pthread_create(&s3, NULL, stage3_thread, NULL);
        pthread_join(s1, NULL);
        for (int k = 0; k < n_stage2; k++) pthread_join(s2[k], NULL);
        pthread_join(s3, NULL);
        double tp = now() - t;
        printf("Pipeline, %d stage-2 thread(s): %.4fs speedup %.2f %s\n", n_stage2, tp, ts / tp,
               checksum == serial ? "OK" : "MISMATCH");
    }
    return 0;
}
