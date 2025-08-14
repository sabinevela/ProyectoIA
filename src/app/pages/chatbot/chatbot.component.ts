import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenAIService } from '../../services/openai.service';

interface ChatMessage {
  user: boolean;
  type: 'text' | 'audio';
  content: string;
  timestamp?: Date;
  audioUrl?: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('chatBox') private chatBox!: ElementRef<HTMLDivElement>;
  userInput = '';
  messages: ChatMessage[] = [];
  isTyping = false;
  isRecording = false;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private isProcessingAudio = false;

  constructor(private openAIService: OpenAIService) {}

  private typewriterEffect(text: string, messageIndex: number): void {
    const words = text.split(' ');
    let currentWordIndex = 0;

    const typeNextWord = () => {
      if (currentWordIndex < words.length && this.messages[messageIndex]) {
        if (currentWordIndex === 0) {
          this.messages[messageIndex].content = words[currentWordIndex];
        } else {
          this.messages[messageIndex].content += ' ' + words[currentWordIndex];
        }
        currentWordIndex++;
        this.scrollToBottom();
        setTimeout(typeNextWord, 50);
      } else {
        this.generateBotSpeech(this.messages[messageIndex].content, messageIndex);
        this.stopTyping();
        this.scrollToBottom();
      }
    };

    typeNextWord();
  }

  private async generateBotSpeech(text: string, messageIndex: number): Promise<void> {
    try {
      const audioBlob = await this.openAIService.generateSpeech(text);
      const audioUrl = URL.createObjectURL(audioBlob);
      this.messages[messageIndex].audioUrl = audioUrl;
    } catch (error) {
      console.log('No se pudo generar audio para la respuesta');
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.userInput.trim() || this.isTyping || this.isProcessingAudio) return;

    const userMsg = this.userInput.trim();
    this.addMessage(true, 'text', userMsg);
    this.userInput = '';
    this.simulateTyping();

    try {
      const responseObservable = await this.openAIService.sendMessage(userMsg);

      responseObservable.subscribe({
        next: (botResponse: string) => {
          this.addMessage(false, 'text', '');
          const botMessageIndex = this.messages.length - 1;
          this.typewriterEffect(botResponse, botMessageIndex);
        },
        error: (error) => {
          this.addMessage(false, 'text', 'Lo siento, hubo un error al procesar tu mensaje.');
          this.stopTyping();
          this.scrollToBottom();
        }
      });
    } catch (error) {
      this.addMessage(false, 'text', 'Error al conectar con el asistente.');
      this.stopTyping();
      this.scrollToBottom();
    }
  }

  sendQuickMessage(message: string): void {
    if (this.isTyping || this.isProcessingAudio) return;
    this.userInput = message;
    this.sendMessage();
  }

  async onAudioUpload(event: Event): Promise<void> {
    if (this.isProcessingAudio || this.isTyping) return;

    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (file.size > 25 * 1024 * 1024) {
      this.addMessage(false, 'text', 'El audio es muy grande. Máximo 25MB.');
      input.value = '';
      return;
    }

    this.isProcessingAudio = true;
    const url = URL.createObjectURL(file);
    this.addMessage(true, 'audio', url);
    this.simulateTyping();

    try {
      const transcription = await this.openAIService.transcribeAudio(file);

      if (!transcription.trim()) {
        this.addMessage(false, 'text', 'No pude entender el audio.');
        this.stopTyping();
        this.isProcessingAudio = false;
        input.value = '';
        return;
      }

      const responseObservable = await this.openAIService.sendMessage(transcription);

      responseObservable.subscribe({
        next: (botResponse: string) => {
          this.addMessage(false, 'text', '');
          const botMessageIndex = this.messages.length - 1;
          this.typewriterEffect(botResponse, botMessageIndex);
          this.isProcessingAudio = false;
        },
        error: (error) => {
          this.addMessage(false, 'text', 'Hubo un error al procesar tu audio.');
          this.stopTyping();
          this.scrollToBottom();
          this.isProcessingAudio = false;
        }
      });
    } catch (error) {
      this.addMessage(false, 'text', 'No pude procesar el audio. Intenta de nuevo.');
      this.stopTyping();
      this.scrollToBottom();
      this.isProcessingAudio = false;
    }

    input.value = '';
  }

  async toggleRecording(): Promise<void> {
    if (this.isProcessingAudio) return;

    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.isProcessingAudio = true;

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });

        if (blob.size < 500) {
          this.addMessage(false, 'text', 'La grabación está muy corta o en silencio.');
          stream.getTracks().forEach(t => t.stop());
          this.isProcessingAudio = false;
          return;
        }

        const url = URL.createObjectURL(blob);
        this.addMessage(true, 'audio', url);
        this.simulateTyping();

        try {
          const transcription = await this.openAIService.transcribeAudio(blob);

          if (!transcription.trim()) {
            this.addMessage(false, 'text', 'No pude entender la grabación.');
            this.stopTyping();
            this.scrollToBottom();
            stream.getTracks().forEach(t => t.stop());
            this.isProcessingAudio = false;
            return;
          }

          const responseObservable = await this.openAIService.sendMessage(transcription);

          responseObservable.subscribe({
            next: (botResponse: string) => {
              this.addMessage(false, 'text', '');
              const botMessageIndex = this.messages.length - 1;
              this.typewriterEffect(botResponse, botMessageIndex);
              this.isProcessingAudio = false;
            },
            error: (error) => {
              this.addMessage(false, 'text', 'Hubo un error al procesar tu grabación.');
              this.stopTyping();
              this.scrollToBottom();
              this.isProcessingAudio = false;
            }
          });

        } catch (error) {
          this.addMessage(false, 'text', 'No pude procesar la grabación.');
          this.stopTyping();
          this.scrollToBottom();
          this.isProcessingAudio = false;
        }

        stream.getTracks().forEach(t => t.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;

    } catch (error) {
      this.addMessage(false, 'text', 'No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  private addMessage(user: boolean, type: 'text' | 'audio', content: string): void {
    this.messages.push({
      user,
      type,
      content,
      timestamp: new Date()
    });
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getCurrentDateTime(): string {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  }

  private simulateTyping(): void {
    this.isTyping = true;
  }

  private stopTyping(): void {
    this.isTyping = false;
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const element = this.chatBox.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch {}
  }

  formatMessageDateTime(timestamp: Date): string {
    const date = timestamp.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  }
}
