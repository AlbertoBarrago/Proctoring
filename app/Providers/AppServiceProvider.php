<?php

namespace App\Providers;

use App\Interfaces\ProctoringRepositoryInterface;
use App\Repositories\ProctoringRepository;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ProctoringRepositoryInterface::class, ProctoringRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
