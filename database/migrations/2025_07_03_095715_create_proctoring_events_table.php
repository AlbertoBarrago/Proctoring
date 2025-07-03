<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proctoring_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('session_id');
            $table->string('event_type');
            $table->json('event_data');
            $table->timestamps();

            $table->foreign('session_id')
                ->references('id')
                ->on('proctoring_sessions')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proctoring_events');
    }
};
