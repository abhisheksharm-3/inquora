"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Loader2, 
  FileText, 
  MessageSquare, 
  Sparkles, 
  X
} from "lucide-react";
import { useChatInterface } from "@/hooks/useChatInterface";
import { useState } from "react";

import { ChatInterfaceInput } from "./ChatInterfaceInput";
import { ChatInterfaceDocumentViewer } from "./ChatInterfaceDocumentViewer";
import { ChatInterfaceMessages } from "./ChatInterfaceMessage";
import { cn } from "@/utils/cn";

/**
 * Renders a beautiful and responsive chat interface with glassmorphism design.
 * Features a resizable split-screen on desktop and a modern slide-up panel on mobile.
 * Uses proper shadcn theming and modern UI components.
 */
const ChatInterface = ({ chatId }: { chatId: string }) => {
  const {
    inputValue,
    setInputValue,
    localMessages,
    messagesEndRef,
    chat,
    file,
    isChatLoading,
    messagesLoading,
    isFileLoading,
    isFileError,
    isSending,
    handleSendMessage,
  } = useChatInterface({ chatId });

  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);

  if (isChatLoading || !chat) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Loading Chat</p>
          <p className="text-xs text-muted-foreground">Please wait while we prepare your conversation</p>
        </div>
      </div>
    );
  }

  const DocumentPanel = () => (
    <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      {file ? (
        <div className="h-full w-full">
          <ChatInterfaceDocumentViewer
            file={file}
            isLoading={isFileLoading}
            isError={isFileError}
            title={chat.title || "Document"}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-medium text-foreground">No Document Available</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Upload a document to start analyzing and chatting about its contents
            </p>
          </div>
        </div>
      )}
    </Card>
  );

  const ChatPanel = () => (
    <Card className="flex h-full flex-col border-border/50 bg-card/95 backdrop-blur-md shadow-lg py-0 gap-0 md:m-0 m-0 rounded-none md:rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Chat</h2>
            <p className="text-xs text-muted-foreground">
              {localMessages.length} message{localMessages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSending && localMessages.some(msg => msg.content === "...") && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Thinking
            </Badge>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatInterfaceMessages
          messages={localMessages}
          messagesLoading={messagesLoading}
          messagesEndRef={messagesEndRef}
          isSending={isSending}
        />
      </div>
      
      <Separator className="bg-border/50 shrink-0" />
      
      <div className="p-1 shrink-0">
        <ChatInterfaceInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSendMessage={handleSendMessage}
          isSending={isSending}
        />
      </div>
    </Card>
  );  return (
    <div className="h-full">
      {/* Desktop Layout: Enhanced Resizable Glass Panels */}
      <div className="hidden h-full p-1 md:block">
        <ResizablePanelGroup 
          direction="horizontal" 
          className="h-full gap-4"
        >
          <ResizablePanel defaultSize={45} minSize={30} maxSize={70}>
            <DocumentPanel />
          </ResizablePanel>
          
          <ResizableHandle 
            withHandle 
            className={cn(
              "relative bg-border/50 data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=horizontal]:w-2",
              "transition-colors hover:bg-border",
              "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/20 before:to-secondary/20 before:opacity-0 before:transition-opacity hover:before:opacity-100"
            )}
          />
          
          <ResizablePanel defaultSize={55} minSize={30} maxSize={70}>
            <ChatPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile Layout: Modern Full-Screen Chat with Floating Document Access */}
      <div className="h-full flex flex-col md:hidden relative bg-gradient-to-b from-background to-background/95">
        <ChatPanel />
        
        {/* Floating Document Button with Enhanced UX */}
        {file && (
          <div className="absolute bottom-24 right-6 z-10 flex flex-col items-end gap-3">
            {/* Document Preview Tooltip */}
            {!isDocumentPanelOpen && (
              <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg max-w-[200px] animate-in slide-in-from-right-2 duration-200">
                <p className="text-xs text-muted-foreground mb-1">Document available:</p>
                <p className="text-sm font-medium text-foreground truncate">{chat.title || "Document"}</p>
                <p className="text-xs text-primary mt-1">Tap to view</p>
              </div>
            )}
            
            <Sheet open={isDocumentPanelOpen} onOpenChange={setIsDocumentPanelOpen}>
              <SheetTrigger asChild>
                <Button 
                  size="lg" 
                  className="rounded-full h-16 w-16 shadow-2xl bg-gradient-to-br from-primary to-primary/80 backdrop-blur-sm border border-white/20 hover:from-primary/90 hover:to-primary/70 hover:scale-110 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <FileText className="h-7 w-7 relative z-10 group-hover:scale-110 transition-transform duration-200" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="bottom" 
                className="h-[96vh] p-0 border-none bg-background backdrop-blur-xl rounded-t-3xl shadow-2xl"
              >
                <div className="h-full flex flex-col">
                  {/* Minimal Handle Bar */}
                  <div className="flex items-center justify-center py-2 shrink-0">
                    <div className="w-12 h-1 bg-muted-foreground/40 rounded-full" />
                  </div>
                  
                  {/* Ultra Compact Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 bg-card/30 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <FileText className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {chat.title || "Document"}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsDocumentPanelOpen(false)}
                      className="h-7 w-7 rounded-full hover:bg-muted/50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Maximum Document Content Space */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <DocumentPanel />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;