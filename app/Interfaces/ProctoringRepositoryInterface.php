<?php


namespace App\Interfaces;

interface ProctoringRepositoryInterface
{
    public function startSession(array $data);

    public function endSession(string $sessionId);

    public function logEvent(string $sessionId, array $eventData);

    public function getSession(string $sessionId);

    public function recordViolation(string $sessionId, string $type, int $timestamp, string $details): int;
}
