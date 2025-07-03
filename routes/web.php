<?php

use Illuminate\Support\Facades\Route;
use App\Events\TestPusherEvent;


Route::get('/', function () {
    return view('welcome');
});

Route::get('/test-pusher', function () {
    event(new TestPusherEvent('Hello from Laravel via Pusher!'));
    return 'Event broadcasted!';
});
