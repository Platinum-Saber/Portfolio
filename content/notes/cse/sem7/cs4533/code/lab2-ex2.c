// Lab 02 Ex 2 - single producer, single consumer, circular bounded buffer.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

#ifndef BUFFER_SIZE
#define BUFFER_SIZE 5
#endif

int buffer[BUFFER_SIZE];
int head = 0, tail = 0, count = 0;
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
int N;

void put(int item) {
    pthread_mutex_lock(&mutex);
    while (count == BUFFER_SIZE)                 // full: sleep, do not spin
        pthread_cond_wait(&not_full, &mutex);
    buffer[tail] = item;
    tail = (tail + 1) % BUFFER_SIZE;
    count++;
    pthread_cond_signal(&not_empty);             // there is now at least one item
    pthread_mutex_unlock(&mutex);
}

int get(void) {
    pthread_mutex_lock(&mutex);
    while (count == 0)                           // empty: sleep
        pthread_cond_wait(&not_empty, &mutex);
    int item = buffer[head];
    head = (head + 1) % BUFFER_SIZE;
    count--;
    pthread_cond_signal(&not_full);              // there is now at least one space
    pthread_mutex_unlock(&mutex);
    return item;
}

void *producer(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++) {
        put(i);
        printf("Produced: %d\n", i);
    }
    put(-1);                                     // sentinel: "no more items"
    return NULL;
}

void *consumer(void *arg) {
    (void)arg;
    int expect = 0;
    while (1) {
        int item = get();
        if (item == -1) break;
        if (item != expect++) printf("OUT OF ORDER: %d\n", item);
        printf("Consumed: %d\n", item);
    }
    return NULL;
}

int main(int argc, char *argv[]) {
    N = argc > 1 ? atoi(argv[1]) : 10;
    pthread_t prod, cons;
    pthread_create(&prod, NULL, producer, NULL);
    pthread_create(&cons, NULL, consumer, NULL);
    pthread_join(prod, NULL);
    pthread_join(cons, NULL);
    printf("All items consumed.\n");
    return 0;
}
