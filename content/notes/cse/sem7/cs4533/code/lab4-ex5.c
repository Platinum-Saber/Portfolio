// Lab 04 Ex 5 - reusable two-phase barrier from semaphores + parallel averaging.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <semaphore.h>

typedef struct {
    int n, count;
    sem_t mutex;        // 1: protects count
    sem_t turnstile1;   // 0: phase 1 - nobody passes until all n have arrived
    sem_t turnstile2;   // 0: phase 2 - nobody re-enters until all n have left
} barrier_t;

void barrier_init(barrier_t *b, int n) {
    b->n = n; b->count = 0;
    sem_init(&b->mutex, 0, 1);
    sem_init(&b->turnstile1, 0, 0);
    sem_init(&b->turnstile2, 0, 0);
}

void barrier_wait(barrier_t *b) {
    sem_wait(&b->mutex);
    if (++b->count == b->n)                       // last to arrive opens phase 1 for all n
        for (int i = 0; i < b->n; i++) sem_post(&b->turnstile1);
    sem_post(&b->mutex);
    sem_wait(&b->turnstile1);

    sem_wait(&b->mutex);
    if (--b->count == 0)                          // last to leave opens phase 2 for all n
        for (int i = 0; i < b->n; i++) sem_post(&b->turnstile2);
    sem_post(&b->mutex);
    sem_wait(&b->turnstile2);                     // nobody laps the slow ones
}

void barrier_destroy(barrier_t *b) {
    sem_destroy(&b->mutex); sem_destroy(&b->turnstile1); sem_destroy(&b->turnstile2);
}

#ifndef SIZE
#define SIZE 100
#endif
#ifndef ITERATIONS
#define ITERATIONS 20
#endif
double arr[SIZE], temp[SIZE], serial[SIZE];
int T;
barrier_t bar;

void *worker(void *arg) {
    int id = *(int *)arg;
    int lo = 1 + (SIZE - 2) * id / T, hi = 1 + (SIZE - 2) * (id + 1) / T;
    for (int it = 0; it < ITERATIONS; it++) {
        for (int i = lo; i < hi; i++) temp[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3.0;
        barrier_wait(&bar);                       // everyone has READ the old values
        for (int i = lo; i < hi; i++) arr[i] = temp[i];
        barrier_wait(&bar);                       // everyone has WRITTEN the new values
    }
    return NULL;
}

static void init(double *a) {
    for (int i = 0; i < SIZE; i++) a[i] = (i == 0 || i == SIZE - 1) ? 100.0 : 0.0;
}

int main(int argc, char *argv[]) {
    T = argc > 1 ? atoi(argv[1]) : 4;
    init(serial);                                 // serial reference
    for (int it = 0; it < ITERATIONS; it++) {
        double t2[SIZE];
        for (int i = 1; i < SIZE - 1; i++) t2[i] = (serial[i - 1] + serial[i] + serial[i + 1]) / 3.0;
        for (int i = 1; i < SIZE - 1; i++) serial[i] = t2[i];
    }
    init(arr);
    barrier_init(&bar, T);
    pthread_t t[T];
    int id[T];
    for (int i = 0; i < T; i++) { id[i] = i; pthread_create(&t[i], NULL, worker, &id[i]); }
    for (int i = 0; i < T; i++) pthread_join(t[i], NULL);
    barrier_destroy(&bar);
    printf("%d threads: parallel %s serial (arr[1]=%.6f)\n", T,
           memcmp(arr, serial, sizeof arr) == 0 ? "==" : "!=", arr[1]);
    return 0;
}
