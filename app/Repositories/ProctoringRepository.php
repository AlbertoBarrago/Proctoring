<?php

namespace App\Repositories;

use App\Interfaces\ProctoringRepositoryInterface;
use Illuminate\Support\Facades\DB;

class ProctoringRepository implements ProctoringRepositoryInterface
{
    public function startSession(array $data): int
    {
        return DB::table('proctoring_sessions')->insertGetId([
            'user_id' => $data['user_id'] ?? null,
            'exam_id' => $data['exam_id'] ?? null,
            'start_time' => now(),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    public function endSession(string $sessionId): int
    {
        return DB::table('proctoring_sessions')
            ->where('id', $sessionId)
            ->update([
                'end_time' => now(),
                'status' => 'completed',
                'updated_at' => now()
            ]);
    }

    public function recordViolation(string $sessionId, string $type, int $timestamp, string $details): int
    {
        return DB::table('proctoring_events')->insertGetId([
            'session_id' => $sessionId,
            'event_type' => $type,
            'event_data' => json_encode([
                'details' => $details
            ]),
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }


    public function logEvent(string $sessionId, array $eventData): bool
    {
        return DB::table('proctoring_events')->insert([
            'session_id' => $sessionId,
            'event_type' => $eventData['type'] ?? null,
            'event_data' => json_encode($eventData['data'] ?? []),
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    public function getSession(string $sessionId)
    {
        return DB::table('proctoring_sessions')
            ->where('id', $sessionId)
            ->first();
    }

}
