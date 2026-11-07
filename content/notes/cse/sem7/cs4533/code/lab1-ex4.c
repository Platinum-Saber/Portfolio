// Lab 01 Ex 4 - serial qsort, then a parallel chunked sum; time both phases.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

#ifndef SIZE
#define SIZE 10000000
#endif

int *arr;
typedef struct { int lo, hi; long long sum; } chunk_t;

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}
static int cmp(const void *a, const void *b) {
    int x = *(const int *)a, y = *(const int *)b;
    return (x > y) - (x < y);                // no overflow, unlike x - y
}
void *sum_chunk(void *arg) {
    chunk_t *c = arg;
    long long s = 0;
    for (int i = c->lo; i < c->hi; i++) s += arr[i];
    c->sum = s;                              // each thread writes its own slot
    return NULL;
}

int main(void) {
    int *orig = malloc(SIZE * sizeof(int));
    arr = malloc(SIZE * sizeof(int));
    srand(42);
    for (int i = 0; i < SIZE; i++) orig[i] = rand();

    int ns[] = {1, 2, 4, 8};
    double base = 0;
    printf("%2s %10s %10s %10s %8s\n", "N", "serial", "parallel", "total", "speedup");
    for (int k = 0; k < 4; k++) {
        int n = ns[k];
        for (int i = 0; i < SIZE; i++) arr[i] = orig[i];

        double t0 = now();
        qsort(arr, SIZE, sizeof(int), cmp);              // serial phase
        double t1 = now();

        pthread_t tid[n];
        chunk_t ch[n];
        for (int i = 0; i < n; i++) {                    // parallel phase
            ch[i].lo = (long)SIZE * i / n;
            ch[i].hi = (long)SIZE * (i + 1) / n;          // last chunk takes the remainder
            pthread_create(&tid[i], NULL, sum_chunk, &ch[i]);
        }
        long long total = 0;
        for (int i = 0; i < n; i++) {
            pthread_join(tid[i], NULL);
            total += ch[i].sum;
        }
        double t2 = now();

        if (n == 1) base = t2 - t0;
        printf("%2d %10.4f %10.4f %10.4f %8.2f   (sum %lld)\n",
               n, t1 - t0, t2 - t1, t2 - t0, base / (t2 - t0), total);
    }
    return 0;
}
