// Lab 06 Ex 4 - thread pool over a shared task index (dynamic load balancing).
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <math.h>
#include <time.h>

#ifndef NUM_TASKS
#define NUM_TASKS 200
#endif
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
        tasks[i].difficulty = (rand() % 10 == 0) ? 500000 : 5000;   // ~10% are 100x harder
        tasks[i].result = 0;
    }
}

int next_task = 0;
pthread_mutex_t task_mutex = PTHREAD_MUTEX_INITIALIZER;

void *pool_worker(void *arg) {
    (void)arg;
    for (;;) {
        pthread_mutex_lock(&task_mutex);       // grab-and-advance must be one atomic step
        int idx = next_task++;
        pthread_mutex_unlock(&task_mutex);     // do NOT hold the lock while working
        if (idx >= NUM_TASKS) break;
        do_task(&tasks[idx]);
    }
    return NULL;
}

// For comparison: static partitioning, thread k gets one contiguous block of tasks.
int nthreads;
void *static_worker(void *arg) {
    int k = *(int *)arg;
    for (int i = NUM_TASKS * k / nthreads; i < NUM_TASKS * (k + 1) / nthreads; i++) do_task(&tasks[i]);
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
        pthread_t th[n];
        int ids[n];
        generate_tasks(); next_task = 0;
        t = now();
        for (int i = 0; i < n; i++) pthread_create(&th[i], NULL, pool_worker, NULL);
        for (int i = 0; i < n; i++) pthread_join(th[i], NULL);
        double tp = now() - t;
        generate_tasks();
        t = now();
        for (int i = 0; i < n; i++) { ids[i] = i; pthread_create(&th[i], NULL, static_worker, &ids[i]); }
        for (int i = 0; i < n; i++) pthread_join(th[i], NULL);
        double tst = now() - t;
        printf("Pool (%d threads): %.4fs (speedup %.2fx) | static blocks: %.4fs (%.2fx)\n",
               n, tp, ts / tp, tst, ts / tst);
    }
    return 0;
}
