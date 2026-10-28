'use client';

import { RotateCcwSquare, RotateCwSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Girar la foto de a 90°, a la izquierda o a la derecha. Lo decide la
// persona: Claude no lo propone. La Mac la gira antes del giro fino.

export const TURN_TEXT = ['Sin girar', 'Girada 90° a la derecha', 'Girada 180°', 'Girada 90° a la izquierda'];

export function TurnButtons({ onTurn, disabled }: { onTurn: (by: 1 | -1) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 sm:h-8 sm:w-8"
        aria-label="Girar a la izquierda"
        title="Girar a la izquierda"
        disabled={disabled}
        onClick={() => onTurn(-1)}
      >
        <RotateCcwSquare className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 sm:h-8 sm:w-8"
        aria-label="Girar a la derecha"
        title="Girar a la derecha"
        disabled={disabled}
        onClick={() => onTurn(1)}
      >
        <RotateCwSquare className="h-4 w-4" />
      </Button>
    </div>
  );
}
