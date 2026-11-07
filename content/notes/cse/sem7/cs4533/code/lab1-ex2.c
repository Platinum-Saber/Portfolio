// Lab 01 Ex 2 - N threads each increment an unprotected shared counter M times.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

#ifndef M
#define M 100000
#endif

int counter = 0;                 // shared, unprotected

void *increment(void *arg) {
    for (int i = 0; i < M; i++)
        counter++;               // load, add, store: NOT atomic
    return NULL;
}

int main(int argc, char *argv[]) {
    int n = argc > 1 ? atoi(argv[1]) : 4;
    pthread_t tid[n];
    for (int i = 0; i < n; i++) pthread_create(&tid[i], NULL, increment, NULL);
    for (int i = 0; i < n; i++) pthread_join(tid[i], NULL);
    printf("Expected: %d, Actual: %d, lost: %.2f%%\n",
           n * M, counter, 100.0 * (n * M - counter) / (n * M));
    return 0;
}
