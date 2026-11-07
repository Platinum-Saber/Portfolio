// Lab 04 Ex 1 - one-direction bridge, at most 3 cars, built from semaphores.
// Pattern: "lightswitch" per direction (first in locks the bridge, last out unlocks)
// + a counting semaphore for capacity + a turnstile so one direction cannot starve the other.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>

#ifndef MAX_ON_BRIDGE
#define MAX_ON_BRIDGE 3
#endif
#define CARS_PER_DIR 10

typedef struct { int id, direction; } car_t;     // 0 = N->S, 1 = S->N

sem_t bridge;          // 1: the bridge belongs to one direction (or is empty)
sem_t capacity;        // MAX_ON_BRIDGE: cars allowed on at once
sem_t dir_mutex[2];    // 1 each: protects waiting_dir[d]
sem_t turnstile;       // 1: fairness - a car waiting for the bridge blocks newcomers
int waiting_dir[2];    // cars of direction d that hold the bridge (lightswitch count)

sem_t check;           // 1: protects the validation counters below
int on_bridge[2], violations, passed;

static void validate(int d, int delta) {
    sem_wait(&check);
    on_bridge[d] += delta;
    if ((on_bridge[0] && on_bridge[1]) || on_bridge[d] > MAX_ON_BRIDGE) {
        violations++;
        printf("VIOLATION: N->S=%d S->N=%d\n", on_bridge[0], on_bridge[1]);
    }
    if (delta < 0) passed++;
    sem_post(&check);
}

void *car_thread(void *arg) {
    car_t *car = arg;
    int d = car->direction;
    const char *dir = d == 0 ? "N->S" : "S->N";
    usleep(rand() % 100000);                      // random arrival

    sem_wait(&turnstile);                         // queue fairly
    sem_wait(&dir_mutex[d]);
    if (++waiting_dir[d] == 1) sem_wait(&bridge); // first of my direction claims the bridge
    sem_post(&dir_mutex[d]);
    sem_post(&turnstile);

    sem_wait(&capacity);                          // at most MAX_ON_BRIDGE on it
    validate(d, +1);
    printf("Car %2d [%s]: entering bridge\n", car->id, dir);
    usleep(rand() % 50000);                       // crossing
    printf("Car %2d [%s]: exiting bridge\n", car->id, dir);
    validate(d, -1);
    sem_post(&capacity);

    sem_wait(&dir_mutex[d]);
    if (--waiting_dir[d] == 0) sem_post(&bridge); // last of my direction releases it
    sem_post(&dir_mutex[d]);
    return NULL;
}

int main(void) {
    srand(42);
    sem_init(&bridge, 0, 1);
    sem_init(&capacity, 0, MAX_ON_BRIDGE);
    sem_init(&dir_mutex[0], 0, 1);
    sem_init(&dir_mutex[1], 0, 1);
    sem_init(&turnstile, 0, 1);
    sem_init(&check, 0, 1);

    pthread_t t[2 * CARS_PER_DIR];
    car_t cars[2 * CARS_PER_DIR];
    for (int i = 0; i < 2 * CARS_PER_DIR; i++) {
        cars[i] = (car_t){i, i % 2};
        pthread_create(&t[i], NULL, car_thread, &cars[i]);
    }
    for (int i = 0; i < 2 * CARS_PER_DIR; i++) pthread_join(t[i], NULL);
    printf("Summary: %d cars passed, %d violations\n", passed, violations);

    sem_destroy(&bridge); sem_destroy(&capacity); sem_destroy(&turnstile);
    sem_destroy(&dir_mutex[0]); sem_destroy(&dir_mutex[1]); sem_destroy(&check);
    return 0;
}
