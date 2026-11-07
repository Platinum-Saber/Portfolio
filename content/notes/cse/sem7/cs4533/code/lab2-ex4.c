// Lab 02 Ex 4 - readers-writers, reader preference (writers can starve).
// Define WRITER_PRIORITY to build Ex 5 from the same file.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>

int shared_value = 0, reader_count = 0, writer_active = 0, waiting_writers = 0;
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t can_read = PTHREAD_COND_INITIALIZER;
pthread_cond_t can_write = PTHREAD_COND_INITIALIZER;
struct timespec start_time;
double write_wait_total = 0; int writes = 0;

double elapsed(void) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    return (now.tv_sec - start_time.tv_sec) + (now.tv_nsec - start_time.tv_nsec) / 1e9;
}

void start_read(void) {
    pthread_mutex_lock(&mutex);
#ifdef WRITER_PRIORITY
    while (writer_active || waiting_writers > 0)     // Ex 5: a queued writer blocks new readers
#else
    while (writer_active)                            // Ex 4: only an ACTIVE writer blocks
#endif
        pthread_cond_wait(&can_read, &mutex);
    reader_count++;
    pthread_mutex_unlock(&mutex);
}

void end_read(void) {
    pthread_mutex_lock(&mutex);
    if (--reader_count == 0)                         // last reader out lets a writer in
        pthread_cond_signal(&can_write);
    pthread_mutex_unlock(&mutex);
}

void start_write(void) {
    pthread_mutex_lock(&mutex);
    waiting_writers++;
    while (reader_count > 0 || writer_active)
        pthread_cond_wait(&can_write, &mutex);
    waiting_writers--;
    writer_active = 1;
    pthread_mutex_unlock(&mutex);
}

void end_write(void) {
    pthread_mutex_lock(&mutex);
    writer_active = 0;
#ifdef WRITER_PRIORITY
    if (waiting_writers > 0) pthread_cond_signal(&can_write);   // writers first
    else pthread_cond_broadcast(&can_read);
#else
    pthread_cond_broadcast(&can_read);               // all waiting readers may enter together
    pthread_cond_signal(&can_write);
#endif
    pthread_mutex_unlock(&mutex);
}

void *reader(void *arg) {
    int id = *(int *)arg;
    unsigned seed = id;
    for (int i = 0; i < 5; i++) {
        start_read();
        printf("[%7.3fs] Reader %d: reading (value=%d, active_readers=%d)\n",
               elapsed(), id, shared_value, reader_count);
        usleep(rand_r(&seed) % 100000);
        end_read();
        printf("[%7.3fs] Reader %d: done\n", elapsed(), id);
        usleep(rand_r(&seed) % 50000);
    }
    return NULL;
}

void *writer(void *arg) {
    int id = *(int *)arg;
    unsigned seed = 100 + id;
    for (int i = 0; i < 5; i++) {
        double asked = elapsed();
        start_write();
        double got = elapsed();
        int old = shared_value++;
        printf("[%7.3fs] Writer %d: wrote (value %d -> %d, active_readers=%d)\n",
               got, id, old, shared_value, reader_count);
        usleep(rand_r(&seed) % 100000);
        end_write();
        pthread_mutex_lock(&mutex);
        write_wait_total += got - asked; writes++;
        pthread_mutex_unlock(&mutex);
        printf("[%7.3fs] Writer %d: done\n", elapsed(), id);
        usleep(rand_r(&seed) % 50000);
    }
    return NULL;
}

int main(int argc, char *argv[]) {
    int R = argc > 1 ? atoi(argv[1]) : 5, W = argc > 2 ? atoi(argv[2]) : 5;
    pthread_t r[R], w[W];
    int rid[R], wid[W];
    clock_gettime(CLOCK_MONOTONIC, &start_time);
    for (int i = 0; i < R; i++) { rid[i] = i; pthread_create(&r[i], NULL, reader, &rid[i]); }
    for (int i = 0; i < W; i++) { wid[i] = i; pthread_create(&w[i], NULL, writer, &wid[i]); }
    for (int i = 0; i < R; i++) pthread_join(r[i], NULL);
    for (int i = 0; i < W; i++) pthread_join(w[i], NULL);
    printf("final value=%d, mean writer wait=%.4fs, total=%.3fs\n",
           shared_value, writes ? write_wait_total / writes : 0, elapsed());
    return 0;
}
