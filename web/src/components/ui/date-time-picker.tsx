"use client";

import * as React from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // Unix timestamp in seconds (as string)
  onChange: (value: string) => void; // Callback with Unix timestamp string
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  id,
}: DateTimePickerProps) {
  // Convert Unix timestamp (seconds) to Date object
  const date = React.useMemo(() => {
    if (!value) return undefined;
    const timestamp = parseInt(value, 10);
    if (isNaN(timestamp)) return undefined;
    return new Date(timestamp * 1000);
  }, [value]);

  // Convert Date + time string to Unix timestamp
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange("");
      return;
    }

    // If we already have a time, preserve it
    if (date) {
      const existingTime = date;
      selectedDate.setHours(existingTime.getHours());
      selectedDate.setMinutes(existingTime.getMinutes());
      selectedDate.setSeconds(existingTime.getSeconds());
    } else {
      // Default to current time if no time set
      const now = new Date();
      selectedDate.setHours(now.getHours());
      selectedDate.setMinutes(now.getMinutes());
      selectedDate.setSeconds(0);
    }

    const unixTimestamp = Math.floor(selectedDate.getTime() / 1000);
    onChange(unixTimestamp.toString());
  };

  const handleTimeChange = (timeString: string) => {
    if (!date) {
      // If no date selected, use today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [hours = 0, minutes = 0, seconds = 0] = timeString
        .split(":")
        .map(Number);
      today.setHours(hours, minutes, seconds);
      const unixTimestamp = Math.floor(today.getTime() / 1000);
      onChange(unixTimestamp.toString());
      return;
    }

    const [hours = 0, minutes = 0, seconds = 0] = timeString
      .split(":")
      .map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, seconds);
    const unixTimestamp = Math.floor(newDate.getTime() / 1000);
    onChange(unixTimestamp.toString());
  };

  const timeValue = date
    ? `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`
    : "";

  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "PPP 'at' p")
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                handleDateSelect(selectedDate);
              }
            }}
            captionLayout="dropdown"
            initialFocus
          />
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={timeValue}
                onChange={(e) => handleTimeChange(e.target.value)}
                step="1"
                className="flex-1"
              />
            </div>
            {date && (
              <div className="mt-2 text-xs text-muted-foreground">
                Unix timestamp: {Math.floor(date.getTime() / 1000)}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

