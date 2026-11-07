// Lab 02 Ex 1 - ping/pong strictly alternate using one mutex + one condition variable.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

int turn = 0;                    // 0 = ping's turn, 1 = pong's turn
int N;
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;

static void play(int me, const char *word) {
    for (int i = 0; i < N; i++) {
        pthread_mutex_lock(&mutex);
        while (turn != me)                   // WHILE, not if: re-check after every wake-up
            pthread_cond_wait(&cond, &mutex);
        printf("%s\n", word);
        turn = 1 - me;                       // hand the turn over...
        pthread_cond_signal(&cond);          // ...and wake the other thread
        pthread_mutex_unlock(&mutex);
    }
}
void *ping(void *arg) { (void)arg; play(0, "ping"); return NULL; }
void *pong(void *arg) { (void)arg; play(1, "pong"); return NULL; }

int main(int argc, char *argv[]) {
    N = argc > 1 ? atoi(argv[1]) : 5;
    pthread_t t1, t2;
    pthread_create(&t2, NULL, pong, NULL);   // start pong first: order must not matter
    pthread_create(&t1, NULL, ping, NULL);
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    return 0;
}
