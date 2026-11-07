// Lab 05 Ex 1 - sorted linked list: coarse-grained vs hand-over-hand (fine-grained) locking.
// Only the six TODO functions are shown in the guide; the harness is the one provided.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>
#include <limits.h>

typedef struct node { int key; struct node *next; pthread_mutex_t lock; } node_t;
typedef struct { node_t *head; pthread_mutex_t global_lock; } list_t;

list_t *list_create(void) {
    list_t *l = malloc(sizeof(list_t));
    l->head = malloc(sizeof(node_t));
    l->head->key = INT_MIN; l->head->next = NULL;
    pthread_mutex_init(&l->head->lock, NULL);
    pthread_mutex_init(&l->global_lock, NULL);
    return l;
}
int serial_insert(list_t *l, int key) {
    node_t *prev = l->head, *curr = prev->next;
    while (curr && curr->key < key) { prev = curr; curr = curr->next; }
    if (curr && curr->key == key) return 0;
    node_t *n = malloc(sizeof(node_t));
    n->key = key; n->next = curr;
    pthread_mutex_init(&n->lock, NULL);
    prev->next = n;
    return 1;
}
int serial_contains(list_t *l, int key) {
    node_t *c = l->head->next;
    while (c && c->key < key) c = c->next;
    return c && c->key == key;
}
int serial_delete(list_t *l, int key) {
    node_t *prev = l->head, *curr = prev->next;
    while (curr && curr->key < key) { prev = curr; curr = curr->next; }
    if (!curr || curr->key != key) return 0;
    prev->next = curr->next;
    free(curr);
    return 1;
}

// ---- Coarse-grained: one lock around the whole operation -----------------
int coarse_insert(list_t *l, int key) {
    pthread_mutex_lock(&l->global_lock);
    int r = serial_insert(l, key);
    pthread_mutex_unlock(&l->global_lock);
    return r;
}
int coarse_contains(list_t *l, int key) {
    pthread_mutex_lock(&l->global_lock);
    int r = serial_contains(l, key);
    pthread_mutex_unlock(&l->global_lock);
    return r;
}
int coarse_delete(list_t *l, int key) {
    pthread_mutex_lock(&l->global_lock);
    int r = serial_delete(l, key);
    pthread_mutex_unlock(&l->global_lock);
    return r;
}

// ---- Fine-grained: hand-over-hand ("lock coupling") ----------------------
// Invariant while walking: we hold prev->lock AND curr->lock, so neither node can be
// unlinked or have its next pointer changed under us. To advance: release prev only
// after curr is held, then lock the new curr.
int fine_insert(list_t *l, int key) {
    node_t *prev = l->head;
    pthread_mutex_lock(&prev->lock);
    node_t *curr = prev->next;
    if (curr) pthread_mutex_lock(&curr->lock);
    while (curr && curr->key < key) {
        pthread_mutex_unlock(&prev->lock);       // still holding curr
        prev = curr;
        curr = curr->next;
        if (curr) pthread_mutex_lock(&curr->lock);
    }
    int r = 0;
    if (!curr || curr->key != key) {             // not present: link between prev and curr
        node_t *n = malloc(sizeof(node_t));
        n->key = key; n->next = curr;
        pthread_mutex_init(&n->lock, NULL);
        prev->next = n;
        r = 1;
    }
    if (curr) pthread_mutex_unlock(&curr->lock);
    pthread_mutex_unlock(&prev->lock);
    return r;
}
int fine_contains(list_t *l, int key) {
    node_t *prev = l->head;
    pthread_mutex_lock(&prev->lock);
    node_t *curr = prev->next;
    if (curr) pthread_mutex_lock(&curr->lock);
    while (curr && curr->key < key) {
        pthread_mutex_unlock(&prev->lock);
        prev = curr;
        curr = curr->next;
        if (curr) pthread_mutex_lock(&curr->lock);
    }
    int r = curr && curr->key == key;
    if (curr) pthread_mutex_unlock(&curr->lock);
    pthread_mutex_unlock(&prev->lock);
    return r;
}
int fine_delete(list_t *l, int key) {
    node_t *prev = l->head;
    pthread_mutex_lock(&prev->lock);
    node_t *curr = prev->next;
    if (curr) pthread_mutex_lock(&curr->lock);
    while (curr && curr->key < key) {
        pthread_mutex_unlock(&prev->lock);
        prev = curr;
        curr = curr->next;
        if (curr) pthread_mutex_lock(&curr->lock);
    }
    int r = 0;
    if (curr && curr->key == key) {
        prev->next = curr->next;                 // both locks held: safe to unlink
        pthread_mutex_unlock(&curr->lock);
        pthread_mutex_destroy(&curr->lock);
        free(curr);                              // nobody else can hold curr: they would
        r = 1;                                   // have to hold prev first
    } else if (curr) {
        pthread_mutex_unlock(&curr->lock);
    }
    pthread_mutex_unlock(&prev->lock);
    return r;
}

// ---- Benchmark harness (provided, unchanged) ------------------------------
#ifndef OPS_PER_THREAD
#define OPS_PER_THREAD 25000
#endif
#define KEY_RANGE 1000
typedef struct { list_t *list; int (*insert_fn)(list_t *, int); int (*contains_fn)(list_t *, int);
                 int (*delete_fn)(list_t *, int); unsigned int seed; } thread_arg_t;
void *worker(void *arg) {
    thread_arg_t *ta = arg;
    for (int i = 0; i < OPS_PER_THREAD; i++) {
        int key = rand_r(&ta->seed) % KEY_RANGE, op = rand_r(&ta->seed) % 100;
        if (op < 50) ta->contains_fn(ta->list, key);
        else if (op < 75) ta->insert_fn(ta->list, key);
        else ta->delete_fn(ta->list, key);
    }
    return NULL;
}
double run_benchmark(list_t *list, int (*ins)(list_t *, int), int (*con)(list_t *, int),
                     int (*del)(list_t *, int), int nthreads) {
    pthread_t threads[nthreads];
    thread_arg_t args[nthreads];
    struct timespec start, end;
    for (int i = 0; i < 500; i++) serial_insert(list, rand() % KEY_RANGE);
    clock_gettime(CLOCK_MONOTONIC, &start);
    for (int i = 0; i < nthreads; i++) {
        args[i] = (thread_arg_t){list, ins, con, del, 42 + i};
        pthread_create(&threads[i], NULL, worker, &args[i]);
    }
    for (int i = 0; i < nthreads; i++) pthread_join(threads[i], NULL);
    clock_gettime(CLOCK_MONOTONIC, &end);
    return (end.tv_sec - start.tv_sec) + (end.tv_nsec - start.tv_nsec) / 1e9;
}
int main(void) {
    int thread_counts[] = {1, 2, 4, 8};
    for (int t = 0; t < 4; t++) {
        int n = thread_counts[t];
        list_t *lc = list_create(), *lf = list_create();
        double tc = run_benchmark(lc, coarse_insert, coarse_contains, coarse_delete, n);
        double tf = run_benchmark(lf, fine_insert, fine_contains, fine_delete, n);
        int ops = n * OPS_PER_THREAD;
        printf("%d threads: coarse=%.4fs (%.0f ops/s) fine=%.4fs (%.0f ops/s)\n",
               n, tc, ops / tc, tf, ops / tf);
    }
    return 0;
}
