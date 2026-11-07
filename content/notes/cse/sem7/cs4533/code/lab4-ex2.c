// Lab 04 Ex 2 - construction-zone passage: capacity N (argv), supply vs return trucks.
// Same design as Ex 1; what changes is the variable capacity, timestamps and per-kind counts.
// Pattern: "lightswitch" per direction (first in locks the bridge, last out unlocks)
// + a counting semaphore for capacity + a turnstile so one direction cannot starve the other.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>
#include <time.h>

int N;                 // passage capacity, from the command line
typedef struct { int id, direction; } car_t;     // 0 = supply (to site), 1 = return
static const char *KIND[2] = {"Supply", "Return"};
struct timespec t0;
static double ts(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (t.tv_sec - t0.tv_sec) + (t.tv_nsec - t0.tv_nsec) / 1e9;
}

sem_t bridge;          // 1: the bridge belongs to one direction (or is empty)
sem_t capacity;        // N: vehicles allowed in the passage at once
sem_t dir_mutex[2];    // 1 each: protects waiting_dir[d]
sem_t turnstile;       // 1: fairness - a car waiting for the bridge blocks newcomers
int waiting_dir[2];    // cars of direction d that hold the bridge (lightswitch count)

sem_t check;           // 1: protects the validation counters below
int on_bridge[2], dir_violations, cap_violations, passed;

static void validate(int id, int d, int delta) {
    sem_wait(&check);                          // log inside the lock: counts match the line
    on_bridge[d] += delta;
    if (on_bridge[0] && on_bridge[1]) dir_violations++;
    if (on_bridge[d] > N) cap_violations++;
    if (delta < 0) passed++;
    printf("[%7.3fs] %s %d: %s (supply=%d, return=%d)\n", ts(), KIND[d], id,
           delta > 0 ? "entered" : "exited", on_bridge[0], on_bridge[1]);
    sem_post(&check);
}

void *car_thread(void *arg) {
    car_t *car = arg;
    int d = car->direction;
    usleep(rand() % 100000);                      // random arrival

    sem_wait(&turnstile);                         // queue fairly
    sem_wait(&dir_mutex[d]);
    if (++waiting_dir[d] == 1) sem_wait(&bridge); // first of my direction claims the bridge
    sem_post(&dir_mutex[d]);
    sem_post(&turnstile);

    sem_wait(&capacity);                          // at most N inside
    validate(car->id, d, +1);
    usleep(rand() % 50000);                       // travelling through
    validate(car->id, d, -1);
    sem_post(&capacity);

    sem_wait(&dir_mutex[d]);
    if (--waiting_dir[d] == 0) sem_post(&bridge); // last of my direction releases it
    sem_post(&dir_mutex[d]);
    return NULL;
}

int main(int argc, char *argv[]) {
    N = argc > 1 ? atoi(argv[1]) : 3;
    int S = argc > 2 ? atoi(argv[2]) : 15, R = argc > 3 ? atoi(argv[3]) : 15;
    srand(42);
    clock_gettime(CLOCK_MONOTONIC, &t0);
    sem_init(&bridge, 0, 1);
    sem_init(&capacity, 0, N);
    sem_init(&dir_mutex[0], 0, 1);
    sem_init(&dir_mutex[1], 0, 1);
    sem_init(&turnstile, 0, 1);
    sem_init(&check, 0, 1);

    pthread_t t[S + R];
    car_t cars[S + R];
    for (int i = 0; i < S + R; i++) {
        cars[i] = (car_t){i < S ? i : i - S, i < S ? 0 : 1};
        pthread_create(&t[i], NULL, car_thread, &cars[i]);
    }
    for (int i = 0; i < S + R; i++) pthread_join(t[i], NULL);
    printf("Summary: %d vehicles passed in %.3fs, direction violations=%d, "
           "capacity violations=%d\n", passed, ts(), dir_violations, cap_violations);

    sem_destroy(&bridge); sem_destroy(&capacity); sem_destroy(&turnstile);
    sem_destroy(&dir_mutex[0]); sem_destroy(&dir_mutex[1]); sem_destroy(&check);
    return 0;
}
