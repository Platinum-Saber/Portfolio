// Lab 04 Ex 4 - river crossing: boats of 4H, 4S or 2H+2S only.
// Allen Downey's solution: a mutex for the counts, a queue semaphore per kind,
// and a barrier so nobody leaves before all four have boarded.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>

sem_t mutex;                       // 1: protects hackers, serfs, the boat record
sem_t hacker_queue, serf_queue;    // 0: release exactly the chosen passengers
pthread_barrier_t board;           // 4: all four board before the captain rows
sem_t seat_lock;                   // 1: protects the boat record (NOT mutex: the captain
                                   //    still holds mutex while the group boards)
int hackers = 0, serfs = 0;        // waiting at the bank
int crossings = 0, invalid = 0;
char boat[4][8]; int seats = 0, boat_h = 0, boat_s = 0;

static void take_seat(const char *who) {
    sem_wait(&seat_lock);
    snprintf(boat[seats++], 8, "%s", who);
    if (who[0] == 'H') boat_h++; else boat_s++;
    sem_post(&seat_lock);
}

static void cross(int is_hacker, int id) {
    char who[8];
    snprintf(who, sizeof who, "%c%d", is_hacker ? 'H' : 'S', id);
    usleep(rand() % 50000);
    printf("%s %d: arrived at bank\n", is_hacker ? "Hacker" : "Serf", id);

    int captain = 0;
    sem_wait(&mutex);
    if (is_hacker) hackers++; else serfs++;
    int *mine = is_hacker ? &hackers : &serfs, *other = is_hacker ? &serfs : &hackers;
    sem_t *mq = is_hacker ? &hacker_queue : &serf_queue;
    sem_t *oq = is_hacker ? &serf_queue : &hacker_queue;
    // The thread that completes a group becomes captain and KEEPS mutex until the
    // boat has left, so no second group can be formed while this one boards.
    if (*mine == 4) {                          // 4 of my kind
        for (int i = 0; i < 4; i++) sem_post(mq);
        *mine = 0;
        captain = 1;
    } else if (*mine == 2 && *other >= 2) {    // 2 + 2
        sem_post(mq); sem_post(mq); sem_post(oq); sem_post(oq);
        *mine = 0; *other -= 2;
        captain = 1;
    } else {
        sem_post(&mutex);                      // no group yet: release and wait
    }
    sem_wait(mq);                              // board when released (captain included)
    take_seat(who);
    printf("%s %d: boarding\n", is_hacker ? "Hacker" : "Serf", id);
    pthread_barrier_wait(&board);              // all four on board
    if (captain) {
        int ok = (boat_h == 4) || (boat_s == 4) || (boat_h == 2 && boat_s == 2);
        if (!ok) invalid++;
        crossings++;
        printf("%s %d: rowing as captain! Crossing: [%s, %s, %s, %s] %dH+%dS\n",
               is_hacker ? "Hacker" : "Serf", id, boat[0], boat[1], boat[2], boat[3],
               boat_h, boat_s);
        seats = boat_h = boat_s = 0;           // empty the boat...
        sem_post(&mutex);                      // ...then let the next group form
    }
}

void *hacker(void *a) { cross(1, *(int *)a); return NULL; }
void *serf(void *a) { cross(0, *(int *)a); return NULL; }

int main(int argc, char *argv[]) {
    int H = argc > 1 ? atoi(argv[1]) : 12, S = argc > 2 ? atoi(argv[2]) : 12;
    srand(42);
    sem_init(&mutex, 0, 1); sem_init(&hacker_queue, 0, 0); sem_init(&serf_queue, 0, 0);
    sem_init(&seat_lock, 0, 1);
    pthread_barrier_init(&board, NULL, 4);
    pthread_t t[H + S];
    int id[H + S];
    for (int i = 0; i < H + S; i++) {
        id[i] = i < H ? i : i - H;
        pthread_create(&t[i], NULL, i < H ? hacker : serf, &id[i]);
    }
    for (int i = 0; i < H + S; i++) pthread_join(t[i], NULL);
    printf("total crossings=%d invalid groups=%d\n", crossings, invalid);
    return 0;
}
