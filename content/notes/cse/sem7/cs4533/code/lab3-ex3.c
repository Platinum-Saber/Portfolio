// Lab 03 Ex 3 - parallel 3x3 box blur; compare schedules.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>

#ifndef WIDTH
#define WIDTH 2000
#define HEIGHT 2000
#endif
#define KERNEL 3

int input[HEIGHT][WIDTH], output_serial[HEIGHT][WIDTH], output_parallel[HEIGHT][WIDTH];

void generate_image(void) {
    srand(42);
    for (int i = 0; i < HEIGHT; i++)
        for (int j = 0; j < WIDTH; j++) input[i][j] = rand() % 256;
}

static void blur_row(int i, int out[][WIDTH]) {
    int half = KERNEL / 2;
    for (int j = half; j < WIDTH - half; j++) {
        int sum = 0;
        for (int di = -half; di <= half; di++)
            for (int dj = -half; dj <= half; dj++) sum += input[i + di][j + dj];
        out[i][j] = sum / (KERNEL * KERNEL);
    }
}

void blur_serial(void) {
    for (int i = KERNEL / 2; i < HEIGHT - KERNEL / 2; i++) blur_row(i, output_serial);
}

// Rows are independent: each writes only out[i][*] and reads only input.
// schedule(runtime) lets main() pick the policy through omp_set_schedule().
void blur_parallel(int num_threads) {
    #pragma omp parallel for num_threads(num_threads) schedule(runtime)
    for (int i = KERNEL / 2; i < HEIGHT - KERNEL / 2; i++) blur_row(i, output_parallel);
}

int verify(void) { return memcmp(output_serial, output_parallel, sizeof output_serial) == 0; }

int main(void) {
    generate_image();
    double t = omp_get_wtime();
    blur_serial();
    double ts = omp_get_wtime() - t;
    printf("Serial: %.4fs\n", ts);

    omp_set_schedule(omp_sched_static, 0);
    for (int n = 1; n <= 8; n *= 2) {
        memset(output_parallel, 0, sizeof output_parallel);
        t = omp_get_wtime();
        blur_parallel(n);
        t = omp_get_wtime() - t;
        printf("static %d threads: %.4fs speedup %.2f efficiency %.2f %s\n",
               n, t, ts / t, ts / t / n, verify() ? "OK" : "MISMATCH");
    }
    struct { const char *name; omp_sched_t kind; int chunk; } s[] = {
        {"static     ", omp_sched_static, 0}, {"dynamic    ", omp_sched_dynamic, 1},
        {"dynamic(64)", omp_sched_dynamic, 64}, {"guided     ", omp_sched_guided, 0}};
    for (int k = 0; k < 4; k++) {
        omp_set_schedule(s[k].kind, s[k].chunk);
        t = omp_get_wtime();
        blur_parallel(4);
        printf("%s 4 threads: %.4fs %s\n", s[k].name, omp_get_wtime() - t,
               verify() ? "OK" : "MISMATCH");
    }
    return 0;
}
