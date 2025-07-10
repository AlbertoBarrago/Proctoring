<?php

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Pusher\Pusher;


Route::get('/', function () {
    return view('welcome');
});

Route::get('/test-pusher-direct', function() {
    try {
        Log::info('Testing direct pusher connection');

        $pusher = new Pusher(
            env('PUSHER_APP_KEY'),
            env('PUSHER_APP_SECRET'),
            env('PUSHER_APP_ID'),
            [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => true,
            ]
        );

        $data = ['message' => 'Direct test message'];
        $pusher->trigger('test-channel', 'sound-message', $data);

        Log::info('Direct pusher message sent');
        return 'Direct message sent';

    } catch (\Exception $e) {
        Log::error('Direct pusher error: ' . $e->getMessage());
        return 'Error: ' . $e->getMessage();
    }
});
