<?php

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
Route::post('/proctoring/end', [ProctoringController::class, 'endSession']);
Route::post('/proctoring/violation', [ProctoringController::class, 'recordViolation']);




