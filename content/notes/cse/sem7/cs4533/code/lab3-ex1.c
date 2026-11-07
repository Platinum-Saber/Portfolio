// Lab 03 Ex 1 - Task A hello, Task B shared vs private, Task C parallel for.
#include <stdio.h>
#include <omp.h>

int main(void) {
    // Task A
    int counts[] = {1, 2, 4, 8};
    for (int k = 0; k < 4; k++) {
        omp_set_num_threads(counts[k]);
        #pragma omp parallel
        printf("A: hello from thread %d of %d\n",
               omp_get_thread_num(), omp_get_num_threads());
    }

    // Task B
    int s = 10, p = 20;
    omp_set_num_threads(4);
    #pragma omp parallel shared(s) private(p)
    {
        // p is a NEW, UNINITIALISED copy here - not 20 (firstprivate(p) would copy 20 in)
        printf("B: thread %d sees s=%d, p=%d (garbage)\n", omp_get_thread_num(), s, p);
        p = omp_get_thread_num() * 100;      // changes this thread's copy only
    }
    printf("B: after the region s=%d, p=%d (the original p, untouched)\n", s, p);

    // Task C
    int arr[20];
    #pragma omp parallel for                  // default schedule: static, contiguous blocks
    for (int i = 0; i < 20; i++) {
        arr[i] = i * i;
        printf("C: thread %d computed index %d\n", omp_get_thread_num(), i);
    }
    int ok = 1;
    for (int i = 0; i < 20; i++) ok &= arr[i] == i * i;
    printf("C: results %s\n", ok ? "correct" : "WRONG");
    return 0;
}
