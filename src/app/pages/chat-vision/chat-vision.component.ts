import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface ChatMessage {
  user: boolean;
  type: 'text' | 'image';
  content: string;
  timestamp?: Date;
  isAnalyzing?: boolean;
}

interface ApiResponse {
  success?: boolean;
  prediction?: string;
  prediction_index?: number;
  confidence?: number;
  error?: string;
  debug?: any;
}

@Component({
  selector: 'app-chat-vision',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chat-vision.component.html',
  styleUrl: './chat-vision.component.css'
})
export class ChatVisionComponent implements AfterViewChecked {
  @ViewChild('chatBox') private chatBox!: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  isAnalyzing = false;
  
  // 🔥 Tu API de Google Cloud Run
  private readonly API_URL = 'https://img-221467505226.us-central1.run.app';

  constructor(private http: HttpClient) {
    this.addWelcomeMessage();
  }

  private addWelcomeMessage(): void {
    this.messages.push({
      user: false,
      type: 'text',
      content: '👁️ ¡Hola! Soy **Food Vision**, tu asistente de reconocimiento de comida.\n\n🔍 Sube una imagen y te diré exactamente qué comida es usando inteligencia artificial entrenada con **101 tipos de comida**.\n\n📸 ¡Empecemos!',
      timestamp: new Date()
    });
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.isAnalyzing) return;

    const file = input.files[0];
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      this.addMessage(false, 'text', '❌ **Error:** Por favor, sube solo archivos de imagen (JPG, PNG, WebP, etc.)');
      input.value = '';
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.addMessage(false, 'text', '❌ **Error:** La imagen es muy grande. Por favor, sube una imagen menor a **5MB**.');
      input.value = '';
      return;
    }

    // Crear preview de la imagen
    const reader = new FileReader();
    reader.onload = () => {
      // Agregar imagen del usuario
      this.addMessage(true, 'image', reader.result as string);

      // Agregar mensaje de análisis
      const analyzingMessage: ChatMessage = {
        user: false,
        type: 'text',
        content: '🔍 **Analizando imagen con IA...**\n\nProcesando con modelo Food-101 entrenado...',
        timestamp: new Date(),
        isAnalyzing: true
      };
      this.messages.push(analyzingMessage);
      
      this.scrollToBottom();
      
      // Enviar a la API
      this.analyzeImage(file);
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  private analyzeImage(file: File): void {
    this.isAnalyzing = true;

    // Crear FormData para enviar la imagen
    const formData = new FormData();
    formData.append('image', file);

    // Llamar a la API
    this.http.post<ApiResponse>(this.API_URL, formData).subscribe({
      next: (response) => {
        console.log('✅ Respuesta API:', response);
        this.handleApiResponse(response);
      },
      error: (error) => {
        console.error('❌ Error API:', error);
        this.handleApiError(error);
      }
    });
  }

  private handleApiResponse(response: ApiResponse): void {
    // Remover mensaje de "analizando"
    this.messages = this.messages.filter(msg => !msg.isAnalyzing);

    if (response.success && response.prediction) {
      const confidence = ((response.confidence || 0) * 100).toFixed(1);
      
      let resultMessage = `🎯 **¡Análisis completado!**\n\n`;
      resultMessage += `🍽️ **Comida detectada:** ${response.prediction}\n`;
      resultMessage += `📊 **Confianza:** ${confidence}%\n\n`;
      
      const confidenceNum = parseFloat(confidence);
      if (confidenceNum > 80) {
        resultMessage += `✅ **¡Excelente detección!** Estoy muy seguro de este resultado.`;
      } else if (confidenceNum > 60) {
        resultMessage += `⚠️ **Detección moderada.** Podría ser ${response.prediction} o algo similar.`;
      } else {
        resultMessage += `🤔 **Detección con baja confianza.** La imagen podría no ser muy clara.`;
      }

      this.addMessage(false, 'text', resultMessage);
      
      // Sugerir más análisis
      setTimeout(() => {
        this.addMessage(false, 'text', '📸 **¿Quieres analizar otra imagen?**\n\n¡Sube otra foto y descubramos qué comida es!');
      }, 1500);

    } else {
      let errorMsg = '❌ **Error en el análisis**\n\n';
      if (response.error) {
        errorMsg += `**Detalle:** ${response.error}\n\n`;
      }
      errorMsg += `**Consejo:** Intenta con otra imagen más clara.`;
      
      this.addMessage(false, 'text', errorMsg);
    }

    this.isAnalyzing = false;
    this.scrollToBottom();
  }

  private handleApiError(error: any): void {
    // Remover mensaje de "analizando"
    this.messages = this.messages.filter(msg => !msg.isAnalyzing);
    
    let errorMessage = '❌ **Error al conectar con el servidor**\n\n';
    
    if (error.status === 0) {
      errorMessage += '**Problema:** No se pudo conectar con el servidor.';
    } else if (error.status >= 500) {
      errorMessage += '**Problema:** Error interno del servidor.';
    } else {
      errorMessage += `**Error ${error.status}:** ${error.message || 'Algo salió mal'}`;
    }

    this.addMessage(false, 'text', errorMessage);
    this.isAnalyzing = false;
    this.scrollToBottom();
  }

  private addMessage(user: boolean, type: 'text' | 'image', content: string): void {
    this.messages.push({
      user,
      type,
      content,
      timestamp: new Date()
    });
  }

  formatMessage(content: string): string {
    // Convertir markdown básico a HTML
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/\n/g, '<br>'); // saltos de línea
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const element = this.chatBox.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (error) {
      // Silenciar errores de scroll
    }
  }
}