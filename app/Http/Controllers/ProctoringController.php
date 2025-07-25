<?php

namespace App\Http\Controllers;

use App\Interfaces\ProctoringRepositoryInterface;
use Exception;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Pusher\Pusher;


class ProctoringController extends Controller
{
    private ProctoringRepositoryInterface $proctoringRepository;

    public function __construct(ProctoringRepositoryInterface $proctoringRepository)
    {
        $this->proctoringRepository = $proctoringRepository;
    }

    public function startSession(Request $request): JsonResponse
    {
        try {
            $sessionId = $this->proctoringRepository->startSession($request->all());

            return response()->json([
                'status' => 'success',
                'session_id' => $sessionId
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function uploadChunk(Request $request): JsonResponse
    {
        Log::info('Upload attempt', [
            'has_file' => $request->hasFile('recording_chunk'),
            'files' => $request->allFiles(),
            'post_max_size' => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'content_length' => $request->header('content-length')
        ]);

        try {
            if (!$request->hasFile('recording_chunk')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'No file uploaded'
                ], 400);
            }

            $chunk = $request->file('recording_chunk');
            if (!$chunk->isValid()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid file upload'
                ], 400);
            }

            $sessionId = $request->input('session_id');
            if (empty($sessionId)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Session ID is required'
                ], 400);
            }

            $directory = 'recordings/' . $sessionId;
            Storage::makeDirectory('public/' . $directory);

            // Determine file extension based on the MIME type
            $extension = $chunk->getClientOriginalExtension();
            if (empty($extension)) {
                $mimeType = $chunk->getMimeType();
                if ($mimeType === 'video/webm') {
                    $extension = 'webm';
                } elseif ($mimeType === 'video/mp4') {
                    $extension = 'mp4';
                } else {
                    $extension = 'bin';
                }
            }
            $filename = uniqid('chunk_') . '.' . $extension;
            $path = $chunk->storeAs($directory, $filename, 'public');
            Log::info('File uploaded', [
                'path' => $path,
                'directory' => $directory,
                'filename' => $filename,
                'session_id' => $sessionId,
            ]);

            if (!$path) {
                throw new Exception('Failed to store file');
            }

            return response()->json([
                'status' => 'success',
                'path' => $path
            ]);

        } catch (Exception $e) {
            Log::error('Upload chunk error: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function recordViolation(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'session_id' => 'required|string',
                'type' => 'required|string',
                'timestamp' => 'required|numeric',
                'details' => 'required|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validazione fallita',
                    'errors' => $validator->errors()
                ], 422);
            }

            $violationId = $this->proctoringRepository->recordViolation(
                $request->input('session_id'),
                $request->input('type'),
                $request->input('timestamp'),
                $request->input('details')
            );

            if ($request->input('type') == 'audio_violation') {
                $pusher = new Pusher(
                    env('PUSHER_APP_KEY'),
                    env('PUSHER_APP_SECRET'),
                    env('PUSHER_APP_ID'),
                    [
                        'cluster' => env('PUSHER_APP_CLUSTER'),
                        'useTLS' => true,
                    ]
                );
                $data = [
                    'message' => $request->input('details'),
                    'session_id' => $request->input('session_id'),
                    'timestamp' => now(),
                    'formattedMessage' => "During session {$request->input('session_id')}: {$request->input('details')}"
                ];
                $pusher->trigger('sound-violation', 'sound-message', $data);
            }

            Log::info("Violazione registrata", [
                'session_id' => $request->input('session_id'),
                'type' => $request->input('type'),
                'violation_id' => $violationId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Violazione registrata con successo',
                'violation_id' => $violationId
            ]);
        } catch (Exception $e) {
            Log::error("Errore durante la registrazione della violazione: " . $e->getMessage(), [
                'exception' => $e,
                'session_id' => $request->input('session_id')
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Si è verificato un errore durante la registrazione della violazione',
                'error' => $e->getMessage()
            ], 500);
        } catch (GuzzleException $e) {
            Log::error("Errore durante la registrazione su pusher della violazione: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Errore durante la registrazione su pusher della violazione',
                'error' => $e->getMessage()
            ], 500);
        }
    }


public
function endSession(Request $request): JsonResponse
{
    try {
        $validator = Validator::make($request->all(), [
            'session_id' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validazione fallita',
                'errors' => $validator->errors()
            ], 422);
        }

        $sessionId = $request->input('session_id');

        $result = $this->proctoringRepository->endSession($sessionId);

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => 'Sessione non trovata o non può essere terminata'
            ], 404);
        }

        Log::info("Sessione di proctoring terminata", ['session_id' => $sessionId]);

        return response()->json([
            'success' => true,
            'message' => 'Sessione di proctoring terminata con successo',
            'session_id' => $sessionId
        ]);
    } catch (Exception $e) {
        Log::error("Errore durante la terminazione della sessione: " . $e->getMessage(), [
            'exception' => $e,
            'session_id' => $request->input('session_id')
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Si è verificato un errore durante la terminazione della sessione',
            'error' => $e->getMessage()
        ], 500);
    }
}
}
