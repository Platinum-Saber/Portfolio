// Lab 03 Ex 2 - Monte Carlo pi, four ways to fix the race on count.
#include <stdio.h>
#include <stdlib.h>
#include <omp.h>

#ifndef NUM_DARTS
#define NUM_DARTS 10000000
#endif
#define MAXT 64

static int inside(unsigned *seed) {             // rand_r: thread-safe, per-thread state
    double x = (double)rand_r(seed) / RAND_MAX;
    double y = (double)rand_r(seed) / RAND_MAX;
    return x * x + y * y <= 1.0;
}

long pi_critical(void) {                        // A: one lock round-trip per hit
    long count = 0;
    #pragma omp parallel
    {
        unsigned seed = 42 + omp_get_thread_num();      // declared INSIDE: private
        #pragma omp for
        for (int i = 0; i < NUM_DARTS; i++)
            if (inside(&seed)) {
                #pragma omp critical
                count++;
            }
    }
    return count;
}

long pi_atomic(void) {                          // B: hardware atomic add per hit
    long count = 0;
    #pragma omp parallel
    {
        unsigned seed = 42 + omp_get_thread_num();
        #pragma omp for
        for (int i = 0; i < NUM_DARTS; i++)
            if (inside(&seed)) {
                #pragma omp atomic
                count++;
            }
    }
    return count;
}

long pi_reduction(void) {                       // C: private copies, combined once
    long count = 0;
    #pragma omp parallel
    {
        unsigned seed = 42 + omp_get_thread_num();
        #pragma omp for reduction(+:count)
        for (int i = 0; i < NUM_DARTS; i++)
            if (inside(&seed)) count++;
    }
    return count;
}

long pi_local(void) {                           // D: manual per-thread counters
    long local[MAXT] = {0};
    int nt = 1;
    #pragma omp parallel
    {
        int id = omp_get_thread_num();
        unsigned seed = 42 + id;
        long mine = 0;                          // a register, not local[id] in the loop:
        #pragma omp for                         // adjacent slots share a cache line
        for (int i = 0; i < NUM_DARTS; i++)
            if (inside(&seed)) mine++;
        local[id] = mine;
        #pragma omp single
        nt = omp_get_num_threads();
    }
    long count = 0;
    for (int i = 0; i < nt; i++) count += local[i];   // combine after the region
    return count;
}

int main(void) {
    struct { const char *name; long (*fn)(void); } v[] = {
        {"A critical ", pi_critical}, {"B atomic   ", pi_atomic},
        {"C reduction", pi_reduction}, {"D local    ", pi_local}};
    omp_set_num_threads(4);
    for (int k = 0; k < 4; k++) {
        double t = omp_get_wtime();
        long c = v[k].fn();
        t = omp_get_wtime() - t;
        double pi = 4.0 * c / NUM_DARTS;
        printf("%s pi=%.6f err=%+.6f time=%.4fs\n", v[k].name, pi, pi - 3.141593, t);
    }
    double t1 = 0;
    for (int n = 1; n <= 8; n *= 2) {           // scaling of the best approach
        omp_set_num_threads(n);
        double t = omp_get_wtime();
        pi_reduction();
        t = omp_get_wtime() - t;
        if (n == 1) t1 = t;
        printf("reduction, %d threads: %.4fs speedup %.2f\n", n, t, t1 / t);
    }
    return 0;
}
