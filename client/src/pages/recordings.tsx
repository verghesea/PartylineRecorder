import { useQuery, useMutation } from "@tanstack/react-query";
import { Recording } from "@shared/schema";
import { Clock, Users, Download, Play, Pause, Phone, Search, ChevronDown, Archive, ArchiveRestore, Trash2, FileText, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

export default function RecordingsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: recordings, isLoading } = useQuery<Recording[]>({
    queryKey: ["/api/recordings", { includeArchived: showArchived }],
    queryFn: async () => {
      const url = showArchived ? '/api/recordings?includeArchived=true' : '/api/recordings';
      const response = await fetch(url);
      return response.json();
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [currentTime, setCurrentTime] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState<Record<string, number>>({});
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [recordingToArchive, setRecordingToArchive] = useState<Recording | null>(null);
  const { toast } = useToast();

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/recordings/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Recording archived",
        description: "The recording has been archived successfully.",
      });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/recordings/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Recording restored",
        description: "The recording has been restored successfully.",
      });
    },
  });

  const filteredRecordings = recordings?.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const dateStr = format(new Date(r.createdAt), "MMM d, yyyy h:mm a").toLowerCase();
    const sidStr = (r.recordingSid || "").toLowerCase();
    const confStr = (r.conferenceSid || "").toLowerCase();
    return dateStr.includes(query) || sidStr.includes(query) || confStr.includes(query);
  }) || [];

  const groupedRecordings = groupRecordingsByDate(filteredRecordings);

  const handlePlayPause = (recordingId: string, objectPath: string) => {
    // Pause any currently playing audio
    if (playingId && playingId !== recordingId) {
      const prevAudio = audioElements.get(playingId);
      if (prevAudio) {
        prevAudio.pause();
      }
    }

    let audio = audioElements.get(recordingId);
    
    if (!audio) {
      audio = new Audio(objectPath);
      
      audio.addEventListener('ended', () => setPlayingId(null));
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(prev => ({ ...prev, [recordingId]: audio!.currentTime }));
      });
      audio.addEventListener('loadedmetadata', () => {
        setDuration(prev => ({ ...prev, [recordingId]: audio!.duration }));
      });
      
      audioElements.set(recordingId, audio);
    }

    if (playingId === recordingId) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.play();
      setPlayingId(recordingId);
    }
  };

  const handleSeek = (recordingId: string, time: number) => {
    const audio = audioElements.get(recordingId);
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(prev => ({ ...prev, [recordingId]: time }));
    }
  };

  const handleArchiveClick = (recording: Recording) => {
    setRecordingToArchive(recording);
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchive = () => {
    if (recordingToArchive) {
      archiveMutation.mutate(recordingToArchive.id);
    }
    setArchiveDialogOpen(false);
    setRecordingToArchive(null);
  };

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-6" data-testid="header-main">
            <div className="flex items-center gap-3">
              <Phone className="h-6 w-6 text-primary" data-testid="icon-logo" />
              <h1 className="text-xl font-semibold" data-testid="text-app-title">Partyline Recorder</h1>
            </div>
          </div>
        </header>

        <div className="border-b bg-background py-4">
          <div className="container max-w-7xl px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <div className="h-10 pl-10 pr-4 w-full bg-muted rounded-md" />
              </div>
              <div className="h-10 w-32 bg-muted rounded-md" />
            </div>
          </div>
        </div>

        <main className="container max-w-7xl px-6 py-12">
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-6 w-64 bg-muted rounded" />
                    <div className="h-6 w-20 bg-muted rounded-full" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-9 w-32 bg-muted rounded-md" />
                    <div className="h-9 w-9 bg-muted rounded-md" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const showEmptyState = !recordings || recordings.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6" data-testid="header-main">
          <div className="flex items-center gap-3">
            <Phone className="h-6 w-6 text-primary" data-testid="icon-logo" />
            <h1 className="text-xl font-semibold" data-testid="text-app-title">Partyline Recorder</h1>
          </div>
        </div>
      </header>

      <div className="border-b bg-background py-4">
        <div className="container max-w-7xl px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" data-testid="icon-search" />
              <Input
                type="search"
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="gap-2"
                data-testid="button-toggle-archived"
              >
                <Archive className="h-4 w-4" />
                {showArchived ? "Hide Archived" : "Show Archived"}
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span data-testid="text-sort-label">Newest first</span>
                <ChevronDown className="h-4 w-4" data-testid="icon-sort" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-7xl px-6 py-12">
        {showEmptyState ? (
          <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center">
            <div className="text-center space-y-6" data-testid="empty-state">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Phone className="h-8 w-8 text-muted-foreground" data-testid="icon-empty-state" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold" data-testid="text-empty-title">No recordings yet</h2>
                <p className="text-muted-foreground max-w-md" data-testid="text-empty-description">
                  Dial your toll-free number to start a recorded conference call. 
                  Recordings appear here automatically after calls end.
                </p>
              </div>
              <div className="pt-4">
                <Badge variant="secondary" className="text-sm font-mono" data-testid="badge-info">
                  Up to 15 participants • Auto-recording
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedRecordings).map(([group, groupRecordings]) => (
              <section key={group} className="space-y-4">
                <h2 className="text-lg font-medium text-foreground sticky top-20 bg-background py-2 z-10" data-testid={`heading-group-${group.toLowerCase().replace(/\s+/g, '-')}`}>
                  {group}
                </h2>
                <div className="space-y-3">
                  {groupRecordings.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      isPlaying={playingId === recording.id}
                      onPlayPause={() => handlePlayPause(recording.id, recording.objectPath)}
                      currentTime={currentTime[recording.id] || 0}
                      duration={duration[recording.id] || 0}
                      onSeek={(time) => handleSeek(recording.id, time)}
                      onArchive={() => handleArchiveClick(recording)}
                      onUnarchive={() => handleUnarchive(recording.id)}
                      showArchived={showArchived}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent data-testid="dialog-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-archive-dialog-title">Archive Recording?</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-archive-dialog-description">
              This recording will be archived and hidden from the main list. You can restore it later by viewing archived recordings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-archive-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive} data-testid="button-archive-confirm">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RecordingCardProps {
  recording: Recording;
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  showArchived: boolean;
}

function RecordingCard({ recording, isPlaying, onPlayPause, currentTime, duration, onSeek, onArchive, onUnarchive, showArchived }: RecordingCardProps) {
  const formattedDate = format(new Date(recording.createdAt), "MMM d, yyyy • h:mm a");
  const formattedDuration = formatDuration(recording.duration || 0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [transcriptionOpen, setTranscriptionOpen] = useState(false);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasPhoneNumbers = recording.participantPhoneNumbers && recording.participantPhoneNumbers.length > 0;
  const hasTranscription = recording.transcription && recording.transcriptionStatus === 'completed';

  return (
    <Card
      className="p-4 transition-shadow hover:shadow-md hover-elevate"
      data-testid={`card-recording-${recording.id}`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium truncate" data-testid={`text-date-${recording.id}`}>
              {formattedDate}
            </h3>
          </div>
          {recording.duration && (
            <Badge variant="secondary" className="shrink-0 font-normal" data-testid={`badge-duration-${recording.id}`}>
              <Clock className="h-3 w-3 mr-1" data-testid={`icon-duration-${recording.id}`} />
              {formattedDuration}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {recording.participants !== null && recording.participants > 0 && (
            <div className="flex items-center gap-2" data-testid={`text-participants-${recording.id}`}>
              <Users className="h-4 w-4" data-testid={`icon-participants-${recording.id}`} />
              <span>{recording.participants} participant{recording.participants !== 1 ? 's' : ''}</span>
            </div>
          )}
          {hasPhoneNumbers && (
            <div className="flex items-center gap-2" data-testid={`text-phone-numbers-${recording.id}`}>
              <Phone className="h-4 w-4" data-testid={`icon-phone-${recording.id}`} />
              <span className="font-mono text-xs">
                {recording.participantPhoneNumbers?.join(', ')}
              </span>
            </div>
          )}
          {recording.conferenceSid && (
            <div className="flex items-center gap-2 font-mono text-xs" data-testid={`text-conference-${recording.id}`}>
              <span className="text-muted-foreground/70">Conf:</span>
              <span className="truncate max-w-[200px]">{recording.conferenceSid}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={onPlayPause}
            variant="default"
            size="default"
            className="gap-2"
            data-testid={`button-play-${recording.id}`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" data-testid={`icon-pause-${recording.id}`} />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" data-testid={`icon-play-${recording.id}`} />
                Play Recording
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid={`button-download-${recording.id}`}
          >
            <a href={recording.objectPath} download title="Download recording">
              <Download className="h-4 w-4" data-testid={`icon-download-${recording.id}`} />
            </a>
          </Button>
          {recording.archived === 1 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnarchive}
              title="Restore recording"
              data-testid={`button-unarchive-${recording.id}`}
            >
              <ArchiveRestore className="h-4 w-4" data-testid={`icon-unarchive-${recording.id}`} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onArchive}
              title="Archive recording"
              data-testid={`button-archive-${recording.id}`}
            >
              <Archive className="h-4 w-4" data-testid={`icon-archive-${recording.id}`} />
            </Button>
          )}
        </div>

        {isPlaying && duration > 0 && (
          <div className="pt-2 space-y-2" data-testid={`player-${recording.id}`}>
            <div
              ref={progressBarRef}
              className="h-2 bg-muted rounded-full cursor-pointer hover-elevate"
              onClick={handleProgressClick}
              data-testid={`progress-bar-${recording.id}`}
            >
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
                data-testid={`progress-fill-${recording.id}`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono" data-testid={`time-display-${recording.id}`}>
              <span data-testid={`text-current-time-${recording.id}`}>{formatTime(currentTime)}</span>
              <span data-testid={`text-total-time-${recording.id}`}>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {hasTranscription && (
          <Collapsible open={transcriptionOpen} onOpenChange={setTranscriptionOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm"
                data-testid={`button-transcription-toggle-${recording.id}`}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${transcriptionOpen ? 'rotate-90' : ''}`} />
                <FileText className="h-4 w-4" />
                <span>Transcription</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div 
                className="text-sm text-muted-foreground bg-muted/50 rounded-md p-4 whitespace-pre-wrap"
                data-testid={`text-transcription-${recording.id}`}
              >
                {recording.transcription}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Card>
  );
}

function groupRecordingsByDate(recordings: Recording[]): Record<string, Recording[]> {
  const groups: Record<string, Recording[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  };

  recordings.forEach((recording) => {
    const date = new Date(recording.createdAt);
    
    if (isToday(date)) {
      groups.Today.push(recording);
    } else if (isYesterday(date)) {
      groups.Yesterday.push(recording);
    } else if (isThisWeek(date)) {
      groups["This Week"].push(recording);
    } else if (isThisMonth(date)) {
      groups["This Month"].push(recording);
    } else {
      groups.Older.push(recording);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let result = `${hours}h`;
    if (mins > 0) result += ` ${mins}m`;
    if (secs > 0) result += ` ${secs}s`;
    return result;
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
