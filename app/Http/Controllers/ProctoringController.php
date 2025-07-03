<?php

namespace App\Http\Controllers;

use App\Interfaces\ProctoringRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;


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


}
