// Lab 06 Ex 5 - work stealing: a deque per thread, pop own back, steal others' front.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <math.h>
#include <time.h>

#ifndef NUM_TASKS
#define NUM_TASKS 200
#endif
#define MAXT 16
typedef struct { int id, difficulty; double result; } task_t;
task_t tasks[NUM_TASKS];
void do_task(task_t *t) {
    double v = t->id;
    for (int i = 0; i < t->difficulty; i++) v = sin(v) * cos(v) + 1.0;
    t->result = v;
}
void generate_tasks(void) {
    srand(42);
    for (int i = 0; i < NUM_TASKS; i++) {
        tasks[i].id = i;
        tasks[i].difficulty = (rand() % 10 == 0) ? 500000 : 5000;
        tasks[i].result = 0;
    }
}

typedef struct {
    int items[NUM_TASKS];
    int front, back;                     // live items are items[front .. back-1]
    pthread_mutex_t lock;                // one lock PER deque (fine-grained)
} deque_t;

void deque_init(deque_t *d) { d->front = d->back = 0; pthread_mutex_init(&d->lock, NULL); }
void deque_push(deque_t *d, int task_id) {
    pthread_mutex_lock(&d->lock);
    d->items[d->back++] = task_id;
    pthread_mutex_unlock(&d->lock);
}
int deque_pop(deque_t *d) {              // owner: LIFO from the back (hot in cache)
    int t = -1;
    pthread_mutex_lock(&d->lock);
    if (d->back > d->front) t = d->items[--d->back];
    pthread_mutex_unlock(&d->lock);
    return t;
}
int deque_steal(deque_t *d) {            // thief: FIFO from the front (oldest work)
    int t = -1;
    pthread_mutex_lock(&d->lock);
    if (d->back > d->front) t = d->items[d->front++];
    pthread_mutex_unlock(&d->lock);
    return t;
}

deque_t dq[MAXT];
int nthreads;
int remaining;                           // tasks not yet taken by anyone
int steals;

void *ws_worker(void *arg) {
    int me = *(int *)arg;
    unsigned seed = 1234 + me;
    for (;;) {
        int t = deque_pop(&dq[me]);
        if (t < 0) {                     // own deque empty: try to steal
            if (__sync_fetch_and_add(&remaining, 0) == 0) break;   // nothing left anywhere
            int victim = rand_r(&seed) % nthreads;
            if (victim == me) continue;
            t = deque_steal(&dq[victim]);
            if (t < 0) continue;
            __sync_fetch_and_add(&steals, 1);
        }
        __sync_fetch_and_sub(&remaining, 1);
        do_task(&tasks[t]);
    }
    return NULL;
}

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec / 1e9; }

int main(void) {
    generate_tasks();
    double t = now();
    for (int i = 0; i < NUM_TASKS; i++) do_task(&tasks[i]);
    double ts = now() - t;
    printf("Serial: %.4fs\n", ts);
    int tc[] = {2, 4, 8};
    for (int k = 0; k < 3; k++) {
        int n = nthreads = tc[k];
        generate_tasks();
        for (int i = 0; i < n; i++) deque_init(&dq[i]);
        for (int i = 0; i < NUM_TASKS; i++) deque_push(&dq[i % n], i);   // round-robin
        remaining = NUM_TASKS; steals = 0;
        pthread_t th[n];
        int ids[n];
        t = now();
        for (int i = 0; i < n; i++) { ids[i] = i; pthread_create(&th[i], NULL, ws_worker, &ids[i]); }
        for (int i = 0; i < n; i++) pthread_join(th[i], NULL);
        double tp = now() - t;
        int done = 1;
        for (int i = 0; i < NUM_TASKS; i++) done &= tasks[i].result != 0;
        printf("Work stealing (%d threads): %.4fs (speedup %.2fx), %d steals, %s\n",
               n, tp, ts / tp, steals, done ? "all tasks done" : "TASKS MISSED");
    }
    return 0;
}
