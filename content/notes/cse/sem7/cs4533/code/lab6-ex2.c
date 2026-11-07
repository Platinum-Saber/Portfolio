// Lab 06 Ex 2 - parallel sum over an unbalanced tree: fork a pthread per big subtree.
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <time.h>

typedef struct node { int value; struct node *left, *right; } node_t;

node_t *build_tree(int depth, int max_depth, int *id) {
    if (depth > max_depth) return NULL;
    node_t *n = malloc(sizeof(node_t));
    n->value = ++(*id);
    n->left = build_tree(depth + 1, max_depth, id);
    n->right = build_tree(depth + 1, max_depth - (depth % 2 == 0 ? 2 : 0), id);
    return n;
}
long serial_sum(node_t *n) { return n ? n->value + serial_sum(n->left) + serial_sum(n->right) : 0; }

// Subtree sizes, computed once (node values are unique ids 1..N, so they index an array).
int *size_of;
int fill_sizes(node_t *n) {
    if (!n) return 0;
    return size_of[n->value] = 1 + fill_sizes(n->left) + fill_sizes(n->right);
}
static int sz(node_t *n) { return n ? size_of[n->value] : 0; }

int threshold;
typedef struct { node_t *n; long result; } job_t;
void *parallel_sum_thread(void *arg);

long parallel_sum(node_t *n) {
    if (!n) return 0;
    if (sz(n) < threshold) return serial_sum(n);        // small: no thread is worth it
    job_t left = {n->left, 0};
    pthread_t t;
    int forked = sz(n->left) >= threshold &&
                 pthread_create(&t, NULL, parallel_sum_thread, &left) == 0;
    if (!forked) left.result = parallel_sum(n->left);   // too small, or out of threads
    long right = parallel_sum(n->right);                // this thread takes the right side
    if (forked) pthread_join(t, NULL);
    return n->value + left.result + right;
}
void *parallel_sum_thread(void *arg) {
    job_t *j = arg;
    j->result = parallel_sum(j->n);
    return NULL;
}

static double now(void) {
    struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}
int main(int argc, char *argv[]) {
    int depth = argc > 1 ? atoi(argv[1]) : 22;
    int id = 0;
    node_t *root = build_tree(0, depth, &id);
    size_of = calloc(id + 1, sizeof(int));
    fill_sizes(root);
    printf("Nodes: %d\n", id);
    double t = now();
    long s = serial_sum(root);
    double ts = now() - t;
    printf("Serial sum: %ld (%.4fs)\n", s, ts);
    int th[] = {100, 1000, 10000, 100000};
    for (int k = 0; k < 4; k++) {
        threshold = th[k];
        t = now();
        long p = parallel_sum(root);
        double tp = now() - t;
        printf("threshold %6d: %.4fs speedup %.2f %s\n", threshold, tp, ts / tp,
               p == s ? "OK" : "MISMATCH");
    }
    return 0;
}
