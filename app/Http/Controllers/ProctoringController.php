<?php

namespace App\Http\Controllers;

use App\Interfaces\ProctoringRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;



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
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function uploadChunk(Request $request): JsonResponse
    {
        Log::info('Upload request received', [
            'has_file' => $request->hasFile('recording_chunk'),
            'all_inputs' => $request->all(),
            'files' => $request->allFiles()
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

            $path = $chunk->store($directory, 'public');

            if (!$path) {
                throw new \Exception('Failed to store file');
            }

            return response()->json([
                'status' => 'success',
                'path' => $path
            ]);

        } catch (\Exception $e) {
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
        } catch (\Exception $e) {
            Log::error("Errore durante la registrazione della violazione: " . $e->getMessage(), [
                'exception' => $e,
                'session_id' => $request->input('session_id')
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Si è verificato un errore durante la registrazione della violazione',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    public function endSession(Request $request): JsonResponse
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
        } catch (\Exception $e) {
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
