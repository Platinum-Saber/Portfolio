// Lab 01 Ex 3 - Part A: lock every increment. Part B: count locally, lock once.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

#ifndef M
#define M 100000
#endif

long counter = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void *inc_global_mutex(void *arg) {          // Part A
    for (int i = 0; i < M; i++) {
        pthread_mutex_lock(&lock);
        counter++;                           // critical section: 1 instruction
        pthread_mutex_unlock(&lock);
    }
    return NULL;
}

void *inc_local(void *arg) {                 // Part B
    long local = 0;                          // private: no sharing, no lock
    for (int i = 0; i < M; i++)
        local++;
    pthread_mutex_lock(&lock);               // ONE lock per thread
    counter += local;
    pthread_mutex_unlock(&lock);
    return NULL;
}

double run(void *(*fn)(void *), int n) {
    pthread_t tid[n];
    struct timespec s, e;
    counter = 0;
    clock_gettime(CLOCK_MONOTONIC, &s);
    for (int i = 0; i < n; i++) pthread_create(&tid[i], NULL, fn, NULL);
    for (int i = 0; i < n; i++) pthread_join(tid[i], NULL);
    clock_gettime(CLOCK_MONOTONIC, &e);
    if (counter != (long)n * M) printf("WRONG: %ld\n", counter);
    return (e.tv_sec - s.tv_sec) + (e.tv_nsec - s.tv_nsec) / 1e9;
}

int main(void) {
    int ns[] = {1, 2, 4, 8, 16};
    printf("%4s %12s %12s\n", "N", "A: mutex (s)", "B: local (s)");
    for (int k = 0; k < 5; k++)
        printf("%4d %12.6f %12.6f\n", ns[k],
               run(inc_global_mutex, ns[k]), run(inc_local, ns[k]));
    return 0;
}
