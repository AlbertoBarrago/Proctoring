<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProctoringController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes are loaded by the RouteServiceProvider, and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::post('/proctoring/start', [ProctoringController::class, 'startSession']);
Route::post('/proctoring/upload-chunk', [ProctoringController::class, 'uploadChunk']);



