import { Component, ElementRef, ViewChild, AfterViewChecked, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  styleUrl: './chat-vision.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA] 
})
export class ChatVisionComponent implements AfterViewChecked {
  @ViewChild('chatBox') private chatBox!: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  isAnalyzing = false;
  currentTime = '';
  private readonly API_URL = 'https://img-221467505226.us-central1.run.app';

  constructor(private http: HttpClient) {
    this.updateTime();
    this.addWelcomeMessage();
    setInterval(() => this.updateTime(), 1000);
  }

  private updateTime(): void {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES');
    const time = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    this.currentTime = `${date} ${time}`;
  }

  private addWelcomeMessage(): void {
    this.addMessage(false, 'text', '👋 **¡Bienvenido al Analizador de Comida con IA!**\n\n📸 **¿Cómo funciona?**\n• Sube una foto de comida\n• La IA la analizará automáticamente\n• Te dirá qué tipo de comida es\n\n🚀 **¡Empecemos! Sube tu primera imagen.**');
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

    console.log('🚀 Enviando imagen a API:', this.API_URL);
    console.log('📁 Archivo:', file.name, file.size, 'bytes');

    // Crear FormData para enviar la imagen
    const formData = new FormData();
    formData.append('image', file);

    // Llamar a la API con timeout y manejo completo de errores
    this.http.post<ApiResponse>(this.API_URL, formData, {
      headers: {
        // No agregar Content-Type, deja que el browser lo maneje automáticamente
      }
    }).subscribe({
      next: (response) => {
        console.log('✅ Respuesta API:', response);
        this.handleApiResponse(response);
      },
      error: (error) => {
        console.error('❌ Error API completo:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Message:', error.message);
        console.error('❌ URL:', error.url);
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
      errorMessage += '**Problema:** No se pudo conectar con el servidor.\n\n**Posibles causas:**\n• Problemas de red\n• Servidor temporalmente inactivo\n• CORS no configurado';
    } else if (error.status >= 500) {
      errorMessage += '**Problema:** Error interno del servidor.\n\n**Consejo:** Intenta nuevamente en unos minutos.';
    } else if (error.status === 400) {
      errorMessage += '**Problema:** Error en el formato de la imagen.\n\n**Consejo:** Asegúrate de subir una imagen válida.';
    } else {
      errorMessage += `**Error ${error.status}:** ${error.message || 'Algo salió mal'}\n\n**Consejo:** Intenta nuevamente.`;
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
    this.scrollToBottom();
  }

  formatMessage(content: string): string {
    // Convertir markdown básico a HTML de forma segura
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/\n/g, '<br>'); // saltos de línea
  }

  getMessageTime(message: ChatMessage): string {
    if (!message.timestamp) return '';
    const date = message.timestamp.toLocaleDateString('es-ES');
    const time = message.timestamp.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${date} ${time}`;
  }

  getCurrentTime(): string {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES');
    const time = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${date} ${time}`;
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  clearChat(): void {
    this.messages = [];
    this.isAnalyzing = false;
    this.addWelcomeMessage();
  }

  private scrollToBottom(): void {
    try {
      if (this.chatBox?.nativeElement) {
        const element = this.chatBox.nativeElement;
        setTimeout(() => {
          element.scrollTop = element.scrollHeight;
        }, 100);
      }
    } catch (error) {
      // Silenciar errores de scroll
    }
  }
}