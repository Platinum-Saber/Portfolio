// Lab 03 Ex 4 - merge sort with OpenMP tasks and a depth cut-off.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>

#ifndef SIZE
#define SIZE 10000000
#endif
#ifndef DEPTH_LIMIT
#define DEPTH_LIMIT 10
#endif

void merge(int *arr, int *temp, int left, int mid, int right) {
    int i = left, j = mid + 1, k = left;
    while (i <= mid && j <= right) temp[k++] = arr[i] <= arr[j] ? arr[i++] : arr[j++];
    while (i <= mid) temp[k++] = arr[i++];
    while (j <= right) temp[k++] = arr[j++];
    memcpy(arr + left, temp + left, (right - left + 1) * sizeof(int));
}

void merge_sort(int *arr, int *temp, int left, int right) {
    if (left >= right) return;
    int mid = (left + right) / 2;
    merge_sort(arr, temp, left, mid);
    merge_sort(arr, temp, mid + 1, right);
    merge(arr, temp, left, mid, right);
}

void merge_sort_parallel(int *arr, int *temp, int left, int right, int depth) {
    if (left >= right) return;
    if (depth > DEPTH_LIMIT) {                 // granularity control: small = serial
        merge_sort(arr, temp, left, right);
        return;
    }
    int mid = (left + right) / 2;
    #pragma omp task                           // arr, temp, left, mid: firstprivate by default
    merge_sort_parallel(arr, temp, left, mid, depth + 1);
    #pragma omp task
    merge_sort_parallel(arr, temp, mid + 1, right, depth + 1);
    #pragma omp taskwait                       // both halves sorted BEFORE merging
    merge(arr, temp, left, mid, right);        // halves touch disjoint ranges of temp
}

int is_sorted(int *a, int n) {
    for (int i = 1; i < n; i++) if (a[i] < a[i - 1]) return 0;
    return 1;
}

int main(void) {
    int *arr = malloc(SIZE * sizeof(int)), *temp = malloc(SIZE * sizeof(int)),
        *backup = malloc(SIZE * sizeof(int));
    srand(42);
    for (int i = 0; i < SIZE; i++) arr[i] = rand();
    memcpy(backup, arr, SIZE * sizeof(int));

    double t = omp_get_wtime();
    merge_sort(arr, temp, 0, SIZE - 1);
    double ts = omp_get_wtime() - t;
    printf("Serial: %.4fs sorted: %s\n", ts, is_sorted(arr, SIZE) ? "YES" : "NO");

    for (int n = 1; n <= 8; n *= 2) {
        memcpy(arr, backup, SIZE * sizeof(int));
        t = omp_get_wtime();
        #pragma omp parallel num_threads(n)
        #pragma omp single                     // ONE thread starts the recursion;
        merge_sort_parallel(arr, temp, 0, SIZE - 1, 0);   // the team runs the tasks
        t = omp_get_wtime() - t;
        printf("%d threads: %.4fs speedup %.2f sorted: %s\n",
               n, t, ts / t, is_sorted(arr, SIZE) ? "YES" : "NO");
    }
    free(arr); free(temp); free(backup);
    return 0;
}
