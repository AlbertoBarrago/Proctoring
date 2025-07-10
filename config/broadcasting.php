<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Broadcast Driver
    |--------------------------------------------------------------------------
    |
    | This option controls the default broadcast driver that will be used by
    | the framework when broadcasting events. By default, we will use the
    | "null" driver which does not actually broadcast any events.
    |
    | Supported: "pusher", "redis", "log", "null", "ably"
    |
    */

    'default' => env('BROADCAST_DRIVER', 'null'),

    /*
    |--------------------------------------------------------------------------
    | Broadcast Connections
    |--------------------------------------------------------------------------
    |
    | Here you may define all the broadcast connections that will be used
    | to broadcast events to other servers or an API. Of course, each of
    | these connections has its own configuration options.
    |
    */

    'connections' => [

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'encrypted' => true,
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => true,
            ],
        ],
        'client_options' => [

        ],
    ],

    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
    ],

    'log' => [
        'driver' => 'log',
    ],

    'null' => [
        'driver' => 'null',
    ],

    'ably' => [
        'driver' => 'ably',
        'key' => env('ABLY_KEY'),
    ],

    'options' => [
        'cluster' => 'eu',
        'useTLS' => true
    ],
];
