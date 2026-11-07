// Lab 06 Ex 1 - Mandelbrot rows: schedule(static) vs schedule(dynamic).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>

#ifndef W
#define W 2000
#define H 2000
#endif
#define MAX_ITER 1000
int image[H][W], reference[H][W];

int mandelbrot(double cx, double cy) {
    double zx = 0, zy = 0;
    int iter = 0;
    while (zx * zx + zy * zy <= 4.0 && iter < MAX_ITER) {
        double tmp = zx * zx - zy * zy + cx;
        zy = 2.0 * zx * zy + cy;
        zx = tmp;
        iter++;
    }
    return iter;
}
void compute_serial(void) {
    for (int j = 0; j < H; j++)
        for (int i = 0; i < W; i++)
            image[j][i] = mandelbrot(-2.0 + 3.0 * i / W, -1.5 + 3.0 * j / H);
}
void compute_static(int num_threads) {
    omp_set_num_threads(num_threads);
    #pragma omp parallel for schedule(static)   // equal BLOCKS of rows, fixed up front
    for (int j = 0; j < H; j++)                  // j is private (the loop variable);
        for (int i = 0; i < W; i++)              // i is declared inside: private too
            image[j][i] = mandelbrot(-2.0 + 3.0 * i / W, -1.5 + 3.0 * j / H);
}
void compute_dynamic(int num_threads) {
    omp_set_num_threads(num_threads);
    #pragma omp parallel for schedule(dynamic)  // one row at a time, to whoever is free
    for (int j = 0; j < H; j++)
        for (int i = 0; i < W; i++)
            image[j][i] = mandelbrot(-2.0 + 3.0 * i / W, -1.5 + 3.0 * j / H);
}
int main(void) {
    double t = omp_get_wtime();
    compute_serial();
    printf("Serial: %.4fs\n", omp_get_wtime() - t);
    memcpy(reference, image, sizeof image);
    for (int n = 1; n <= 8; n *= 2) {
        t = omp_get_wtime(); compute_static(n);
        double ts = omp_get_wtime() - t;
        int ok_s = memcmp(image, reference, sizeof image) == 0;
        t = omp_get_wtime(); compute_dynamic(n);
        double td = omp_get_wtime() - t;
        int ok_d = memcmp(image, reference, sizeof image) == 0;
        printf("%d threads: static %.4fs %s | dynamic %.4fs %s | dynamic is %.2fx faster\n",
               n, ts, ok_s ? "OK" : "DIFF", td, ok_d ? "OK" : "DIFF", ts / td);
    }
    return 0;
}
