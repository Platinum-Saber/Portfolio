// Lab 04 Ex 3 - sleeping barber with M waiting chairs.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>

int M, C;                    // waiting chairs, customers
int waiting = 0;             // customers sitting in waiting chairs
int served = 0, turned_away = 0, finished = 0;
int queue[1024], qhead, qtail; // who is next, so the barber can name them

sem_t mutex;                 // 1: protects waiting, queue and the totals
sem_t customers;             // 0: counts waiting customers; the barber sleeps on it
sem_t barber_ready;          // 0: the barber calls the next customer to the chair
sem_t cut_done;              // 0: the customer waits for the haircut to finish

void *barber(void *arg) {
    (void)arg;
    for (;;) {
        sem_wait(&mutex);
        int idle = waiting == 0;
        int done = finished && idle;
        sem_post(&mutex);
        if (done) break;
        if (idle) printf("Barber: sleeping...\n");
        sem_wait(&customers);                  // sleep until someone arrives
        sem_wait(&mutex);
        if (finished && waiting == 0) { sem_post(&mutex); break; }  // wake-up to go home
        waiting--;
        int id = queue[qhead++];
        sem_post(&mutex);
        sem_post(&barber_ready);               // "next, please"
        printf("Barber: serving customer %d\n", id);
        usleep(rand() % 20000);                // cutting
        printf("Barber: finished customer %d\n", id);
        sem_post(&cut_done);
    }
    return NULL;
}

void *customer(void *arg) {
    int id = *(int *)arg;
    usleep(rand() % 200000);                   // arrival
    sem_wait(&mutex);
    if (waiting == M) {                        // no seat: balk
        turned_away++;
        sem_post(&mutex);
        printf("Customer %d: no seats, leaving\n", id);
        return NULL;
    }
    waiting++;
    queue[qtail++] = id;
    printf("Customer %d: arrived (waiting: %d/%d)\n", id, waiting, M);
    sem_post(&mutex);
    sem_post(&customers);                      // wake the barber if asleep
    sem_wait(&barber_ready);                   // rendezvous: take the chair
    sem_wait(&cut_done);
    sem_wait(&mutex); served++; sem_post(&mutex);
    printf("Customer %d: done, leaving happy\n", id);
    return NULL;
}

int main(int argc, char *argv[]) {
    M = argc > 1 ? atoi(argv[1]) : 3;
    C = argc > 2 ? atoi(argv[2]) : 20;
    srand(42);
    sem_init(&mutex, 0, 1); sem_init(&customers, 0, 0);
    sem_init(&barber_ready, 0, 0); sem_init(&cut_done, 0, 0);
    pthread_t b, c[C];
    int id[C];
    pthread_create(&b, NULL, barber, NULL);
    for (int i = 0; i < C; i++) { id[i] = i; pthread_create(&c[i], NULL, customer, &id[i]); }
    for (int i = 0; i < C; i++) pthread_join(c[i], NULL);
    sem_wait(&mutex); finished = 1; sem_post(&mutex);
    sem_post(&customers);                      // wake the barber so it can go home
    pthread_join(b, NULL);
    printf("served=%d turned away=%d total=%d %s\n", served, turned_away,
           served + turned_away, served + turned_away == C ? "OK" : "MISMATCH");
    return 0;
}
