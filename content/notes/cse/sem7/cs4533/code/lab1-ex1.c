// Lab 01 Ex 1 - create N threads, each returns index^2, main joins and prints.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <pthread.h>

void *worker(void *arg) {
    long idx = (long)(intptr_t)arg;          // index passed BY VALUE in the pointer
    printf("thread %lu: index %ld\n", (unsigned long)pthread_self(), idx);
    return (void *)(intptr_t)(idx * idx);    // small int fits in a pointer
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <num_threads>\n", argv[0]);
        return 1;
    }
    int n = atoi(argv[1]);
    pthread_t *tid = malloc(n * sizeof *tid);

    for (long i = 0; i < n; i++)
        if (pthread_create(&tid[i], NULL, worker, (void *)(intptr_t)i) != 0) {
            perror("pthread_create");
            return 1;
        }

    for (int i = 0; i < n; i++) {            // join in index order: results print in order
        void *ret;
        pthread_join(tid[i], &ret);
        printf("main: thread %d returned %ld\n", i, (long)(intptr_t)ret);
    }
    free(tid);
    return 0;
}
