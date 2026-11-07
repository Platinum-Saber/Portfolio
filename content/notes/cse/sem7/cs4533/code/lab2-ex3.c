// Lab 02 Ex 3 - M producers, C consumers, one bounded buffer, M sentinels.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

#define BUFFER_SIZE 10
#define DONE (-2)                    // returned by get() once every sentinel is in

int buffer[BUFFER_SIZE], head, tail, count;
int M, C, K;                         // producers, consumers, items per producer
int sentinels_seen = 0, finished = 0;
int produced = 0, consumed = 0;
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;

void put(int item) {
    pthread_mutex_lock(&mutex);
    while (count == BUFFER_SIZE)
        pthread_cond_wait(&not_full, &mutex);
    buffer[tail] = item;
    tail = (tail + 1) % BUFFER_SIZE;
    count++;
    pthread_cond_broadcast(&not_empty);      // several consumers may be asleep
    pthread_mutex_unlock(&mutex);
}

int get(void) {
    pthread_mutex_lock(&mutex);
    while (count == 0 && !finished)          // finished: stop waiting for good
        pthread_cond_wait(&not_empty, &mutex);
    if (count == 0) {                        // only possible when finished
        pthread_mutex_unlock(&mutex);
        return DONE;
    }
    int item = buffer[head];
    head = (head + 1) % BUFFER_SIZE;
    count--;
    if (item == -1 && ++sentinels_seen == M) {
        finished = 1;                        // last sentinel: release every consumer
        pthread_cond_broadcast(&not_empty);
    }
    pthread_cond_broadcast(&not_full);
    pthread_mutex_unlock(&mutex);
    return item;
}

void *producer(void *arg) {
    int id = *(int *)arg;
    for (int i = 0; i < K; i++) {
        int v = id * 1000 + i;
        put(v);
        printf("Producer %d: put %d\n", id, v);
        __sync_fetch_and_add(&produced, 1);
    }
    put(-1);
    return NULL;
}

void *consumer(void *arg) {
    int id = *(int *)arg;
    for (;;) {
        int v = get();
        if (v == DONE) break;
        if (v == -1) continue;               // a sentinel: counted in get()
        printf("Consumer %d: got %d\n", id, v);
        __sync_fetch_and_add(&consumed, 1);
    }
    return NULL;
}

int main(int argc, char *argv[]) {
    M = argc > 1 ? atoi(argv[1]) : 3;
    C = argc > 2 ? atoi(argv[2]) : 3;
    K = argc > 3 ? atoi(argv[3]) : 20;
    pthread_t p[M], c[C];
    int pid[M], cid[C];
    struct timespec s, e;
    clock_gettime(CLOCK_MONOTONIC, &s);
    for (int i = 0; i < C; i++) { cid[i] = i; pthread_create(&c[i], NULL, consumer, &cid[i]); }
    for (int i = 0; i < M; i++) { pid[i] = i; pthread_create(&p[i], NULL, producer, &pid[i]); }
    for (int i = 0; i < M; i++) pthread_join(p[i], NULL);
    for (int i = 0; i < C; i++) pthread_join(c[i], NULL);
    clock_gettime(CLOCK_MONOTONIC, &e);
    printf("produced=%d consumed=%d %s (%.4fs)\n", produced, consumed,
           produced == consumed ? "MATCH" : "MISMATCH",
           (e.tv_sec - s.tv_sec) + (e.tv_nsec - s.tv_nsec) / 1e9);
    return 0;
}
