// Lab 05 Ex 2 - the two TODO counters: CAS loop (lock-free) and fetch-and-add.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

#ifndef NUM_INCREMENTS
#define NUM_INCREMENTS 1000000
#endif
long counter = 0;
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;

void *inc_unsafe(void *arg) { (void)arg; for (int i = 0; i < NUM_INCREMENTS; i++) counter++; return NULL; }
void *inc_mutex(void *arg) {
    (void)arg;
    for (int i = 0; i < NUM_INCREMENTS; i++) {
        pthread_mutex_lock(&mutex); counter++; pthread_mutex_unlock(&mutex);
    }
    return NULL;
}

// Version 3: CAS loop. Read, compute, and publish only if nobody changed it meanwhile.
// A failed CAS means ANOTHER thread succeeded - so the system progressed (lock-free),
// but this thread may in principle fail forever (not wait-free).
void *inc_cas(void *arg) {
    (void)arg;
    for (int i = 0; i < NUM_INCREMENTS; i++) {
        long old;
        do {
            old = counter;
        } while (!__sync_bool_compare_and_swap(&counter, old, old + 1));
    }
    return NULL;
}

// Version 4: one atomic read-modify-write instruction (lock xadd on x86): never retries.
void *inc_atomic(void *arg) {
    (void)arg;
    for (int i = 0; i < NUM_INCREMENTS; i++)
        __sync_fetch_and_add(&counter, 1);
    return NULL;
}

typedef struct { const char *name; void *(*func)(void *); } version_t;
int main(void) {
    version_t v[] = {{"Unsafe ", inc_unsafe}, {"Mutex  ", inc_mutex},
                     {"CAS    ", inc_cas},    {"Atomic ", inc_atomic}};
    int tc[] = {1, 2, 4, 8};
    printf("%-8s %3s %12s %10s %8s\n", "Version", "Thr", "Counter", "Expected", "Time(s)");
    for (int k = 0; k < 4; k++) {
        for (int t = 0; t < 4; t++) {
            int n = tc[t];
            long expected = (long)n * NUM_INCREMENTS;
            counter = 0;
            pthread_t th[n];
            struct timespec s, e;
            clock_gettime(CLOCK_MONOTONIC, &s);
            for (int i = 0; i < n; i++) pthread_create(&th[i], NULL, v[k].func, NULL);
            for (int i = 0; i < n; i++) pthread_join(th[i], NULL);
            clock_gettime(CLOCK_MONOTONIC, &e);
            printf("%-8s %3d %12ld %10ld %8.4f %s\n", v[k].name, n, counter, expected,
                   (e.tv_sec - s.tv_sec) + (e.tv_nsec - s.tv_nsec) / 1e9,
                   counter == expected ? "OK" : "WRONG");
        }
    }
    return 0;
}
