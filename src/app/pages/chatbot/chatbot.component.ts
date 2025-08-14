import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenAIService } from '../../services/openai.service';

interface ChatMessage {
  user: boolean;
  type: 'text' | 'image' | 'audio';
  content: string;
  timestamp?: Date;
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
        setTimeout(typeNextWord, 25);
      } else {
        this.stopTyping();
        this.scrollToBottom();
      }
    };

    typeNextWord();
  }

  async sendMessage(): Promise<void> {
    if (!this.userInput.trim() || this.isTyping) return;
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
          console.error('Error del asistente:', error);
          this.addMessage(false, 'text', 'Lo siento, hubo un error al procesar tu mensaje.');
          this.stopTyping();
          this.scrollToBottom();
        }
      });
    } catch (error) {
      console.error('Error al iniciar conversación:', error);
      this.addMessage(false, 'text', 'Error al conectar con el asistente.');
      this.stopTyping();
      this.scrollToBottom();
    }
  }

  sendQuickMessage(message: string): void {
    if (this.isTyping) return;
    this.userInput = message;
    this.sendMessage();
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.isTyping) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.addMessage(false, 'text', 'La imagen es muy grande. Por favor, sube una imagen menor a 5MB.');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.addMessage(true, 'image', reader.result as string);
      this.simulateTyping();
      setTimeout(() => {
        this.addMessage(false, 'text', 'Imagen recibida. ¿Deseas pedir algo similar?');
        this.stopTyping();
        this.scrollToBottom();
      }, 1500);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onAudioUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.isTyping) return;
    const file = input.files[0];
    if (file.size > 15 * 1024 * 1024) {
      this.addMessage(false, 'text', 'El audio es muy grande. Por favor, sube un audio menor a 15MB.');
      input.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    this.addMessage(true, 'audio', url);
    this.simulateTyping();
    setTimeout(() => {
      this.addMessage(false, 'text', 'Audio recibido. ¿Quieres que lo procese o continuamos con tu pedido?');
      this.stopTyping();
      this.scrollToBottom();
    }, 1500);
    input.value = '';
  }

  async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        this.addMessage(true, 'audio', url);
        this.simulateTyping();
        setTimeout(() => {
          this.addMessage(false, 'text', 'Grabación recibida. ¿Quieres que la procese o continuamos con tu pedido?');
          this.stopTyping();
          this.scrollToBottom();
        }, 1500);
        stream.getTracks().forEach(t => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch {
      this.addMessage(false, 'text', 'No se pudo acceder al micrófono. Revisa permisos del navegador.');
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  private addMessage(user: boolean, type: 'text' | 'image' | 'audio', content: string): void {
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
