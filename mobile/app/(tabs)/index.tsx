import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ENV from '../../env';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '../../hooks/useThemeColor';
import * as DocumentPicker from 'expo-document-picker';

type ResponseType = {
  summary?: {
    data: string;
    noteType: string;
    key_terms?: string[];
  };
  questions?: {
    data: string[];
    noteType: string;
    key_terms?: string[];
  };
};

type FileType = 'image' | 'pdf';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

const checkFileSize = (file: File | Blob): boolean => {
  return file.size <= MAX_FILE_SIZE;
};

export default function HomeScreen() {
  const { colors } = useThemeColor();
  const [input, setInput] = useState<string>('');
  const [image, setImage] = useState<string | null>(null);
  const [response, setResponse] = useState<ResponseType>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<'summary' | 'questions' | null>(null);
  const [fileType, setFileType] = useState<FileType>('image');
  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Image picker function
  const pickFile = async (type: FileType = 'image') => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = type === 'image' ? 'image/*' : 'application/pdf';
        
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          if (!checkFileSize(file)) {
            Alert.alert('Error', 'File size must be less than 5MB');
            return;
          }

          if (type === 'image') {
            const imageUri = URL.createObjectURL(file);
            setImage(imageUri);
            await handleExtractText(imageUri);
          } else {
            await handlePdfExtract(file);
          }
        };
        input.click();
      } else {
        if (type === 'image') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

          if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
            await handleExtractText(result.assets[0].uri);
          }
        } else {
          const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true,
          });

          if (!result.canceled && result.assets[0]) {
            await handlePdfExtract(result.assets[0]);
          }
        }
      }
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  // API call for OCR and text extraction
  const handleExtractText = async (imageUri: string) => {
    setIsImageProcessing(true);
    setInput('');
    setResponse({});

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('image', blob, 'image.jpg');
      } else {
        const fileName = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
          name: fileName,
          type: type,
        } as any);
      }

      const res = await fetch(`${ENV.API_URL}/extract-text`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setInput(data.extracted_text);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Unable to extract text. Please try again.');
    } finally {
      setIsImageProcessing(false);
    }
  };

  // API call for summarization
  const handleSummarize = async () => {
    if (!input) {
      Alert.alert('Error', 'Please enter or extract text first.');
      return;
    }

    if (response.summary) {
      setActiveTab('summary');
      return;
    }

    setLoadingAction('summary');

    try {
      const res = await fetch(`${ENV.API_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      });

      if (!res.ok) {
        throw new Error('Failed to summarize text');
      }

      const data = await res.json();
      setResponse(prev => ({
        ...prev,
        summary: {
          data: data.summary,
          noteType: data.note_type,
          key_terms: data.key_terms
        }
      }));
    } catch (error) {
      Alert.alert('Error', 'Unable to process text. Please try again.');
    } finally {
      setLoadingAction(null);
      setActiveTab('summary');
      setShowResults(true);
    }
  };

  // API call for question generation
  const handleGenerateQuestions = async () => {
    if (!input) {
      Alert.alert('Error', 'Please enter or extract text first.');
      return;
    }

    if (response.questions) {
      setActiveTab('questions');
      return;
    }

    setLoadingAction('questions');

    try {
      const res = await fetch(`${ENV.API_URL}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await res.json();
      setResponse(prev => ({
        ...prev,
        questions: {
          data: data.questions,
          noteType: data.note_type,
          key_terms: data.key_terms
        }
      }));
    } catch (error) {
      console.error('Question generation error:', error);
      Alert.alert('Error', 'Unable to generate questions. Please try again.');
    } finally {
      setLoadingAction(null);
      setActiveTab('questions');
      setShowResults(true);
    }
  };

  // Add PDF handler
  const handlePdfExtract = async (file: File | DocumentPicker.DocumentPickerAsset) => {
    try {
      setIsImageProcessing(true);
      const formData = new FormData();

      if (file instanceof File) {  // Web
        formData.append('file', file);
      } else {  // Mobile
        formData.append('file', {
          uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
          type: 'application/pdf',
          name: file.name
        } as any);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${ENV.API_URL}/extract-pdf`, {
        method: 'POST',
        body: formData,
        headers: Platform.OS === 'web' 
          ? { 'Accept': 'application/json' }
          : {
              'Accept': 'application/json',
              'Content-Type': 'multipart/form-data',
            },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Failed to extract text: ${errorText}`);
      }

      const data = await response.json();
      if (!data.extracted_text && !data.text) {
        throw new Error('No text extracted from PDF');
      }
      
      setInput(data.extracted_text || data.text);
    } catch (error) {
      console.error('PDF extract error:', error);
      Alert.alert(
        'Error', 
        error instanceof Error ? error.message : 'Failed to extract text from PDF. Please try again.'
      );
    } finally {
      setIsImageProcessing(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    setResponse({});
  };

  const handleDownloadPDF = async () => {
    try {
      // Format the text based on active tab and response data
      const formattedText = activeTab === 'questions' && response.questions
        ? response.questions.data.map((q, i) => `${i + 1}. ${q}`).join('\n\n')
        : response.summary?.data || input;

      const noteType = activeTab === 'questions' 
        ? response.questions?.noteType 
        : response.summary?.noteType || "General Notes";

      const res = await fetch(`${ENV.API_URL}/download-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: formattedText,
          note_type: noteType
        }),
      });

      if (!res.ok) throw new Error('Failed to generate PDF');

      // Rest of the download logic remains the same
      if (Platform.OS === 'web') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'study_notes.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Mobile implementation
        const data = await res.blob();
        const fr = new FileReader();
        fr.onload = async () => {
          const fileUri = `${FileSystem.documentDirectory}study_notes.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, fr.result as string, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          await Share.share({
            url: fileUri,
            title: 'Save PDF',
            message: 'Study Notes PDF'
          });
        };
        fr.readAsDataURL(data);
      }
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert('Error', 'Unable to download PDF. Please try again.');
    }
  };

  const handleReset = () => {
    setInput('');
    setImage(null);
    setResponse({});
    setShowResults(false);
    setActiveTab(null);
    setIsImageProcessing(false);
    setLoadingAction(null);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 24,
    },
    imageSection: {
      marginBottom: 16,
    },
    uploadButton: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 24,
      margin: 8,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputIcon: {
      marginRight: 12,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    input: {
      flex: 1,
      minHeight: 120,
      maxHeight: 200,
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
      textAlignVertical: 'top',
      paddingTop: 0,
      paddingBottom: 0,
    },
    buttonContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      paddingHorizontal: 4,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    secondaryButton: {
      backgroundColor: colors.secondary,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 8,
    },
    imageContainer: {
      position: 'relative',
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
    },
    previewImage: {
      width: '100%',
      borderRadius: 16,
    },
    resultContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scrollContainer: {
      flex: 1,
      padding: 16,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    subtitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 12,
    },
    resultText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
    },
    questionItem: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      padding: 12,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    questionNumber: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 16,
      marginRight: 12,
      minWidth: 24,
    },
    keyTermsSection: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    termsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    termItem: {
      backgroundColor: colors.inputBackground,
      borderRadius: 6,
      padding: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    termText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    processingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    processingText: {
      color: '#FFFFFF',
      marginTop: 8,
      fontSize: 16,
      fontWeight: '500',
    },
    retakeButton: {
      position: 'absolute',
      bottom: 16,
      right: 16,
      backgroundColor: '#F54B64',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
    },
    retakeText: {
      color: '#FFFFFF',
      marginLeft: 4,
      fontSize: 14,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
      backgroundColor: colors.textSecondary,
    },
    uploadText: {
      color: colors.text,
      fontSize: 15,
      marginTop: 8,
      fontWeight: '500',
    },
    questionsContainer: {
      marginTop: 8,
    },
    keyTermsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    keyTermsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
    },
    uploadButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    downloadText: {
      color: colors.primary,
      marginLeft: 4,
      fontSize: 14,
      fontWeight: '500',
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 4,
      margin: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 6,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    activeTab: {
      backgroundColor: colors.primary + '20',  // Semi-transparent primary color
      borderBottomWidth: 0,
    },
    inactiveTab: {
      opacity: 0.7,
    },
    tabText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    resetText: {
      color: colors.primary,
      marginLeft: 4,
      fontSize: 14,
      fontWeight: '500',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    secondaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 4,
    },
    actionText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Study Helper</Text>

      {!showResults ? (
        // Input Section
        <>
          <View style={styles.imageSection}>
            {!image ? (
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => pickFile('image')}
                >
                  <MaterialIcons name="add-photo-alternate" size={32} color={colors.primary} />
                  <Text style={styles.uploadText}>Pick an Image</Text>
      </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => pickFile('pdf')}
                >
                  <MaterialIcons name="picture-as-pdf" size={32} color={colors.primary} />
                  <Text style={styles.uploadText}>Pick a PDF</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: image }} 
                  resizeMode="cover"
                  style={[styles.previewImage, { height: 200 }]}
                />
                {isImageProcessing ? (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={styles.processingText}>Extracting Text...</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.retakeButton}
                    onPress={handleReset}
                  >
                    <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
                    <Text style={styles.retakeText}>Start Over</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons 
              name="edit" 
              size={24} 
              color={colors.textSecondary} 
              style={styles.inputIcon}
            />
      <TextInput
        style={styles.input}
        placeholder="Enter or extracted text will appear here"
              placeholderTextColor={colors.textSecondary}
        multiline
              scrollEnabled={true}
        value={input}
              onChangeText={handleInputChange}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                loadingAction === 'questions' && styles.disabledButton
              ]} 
              onPress={handleSummarize}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'summary' ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.buttonText}>Summarizing...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="summarize" size={24} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Summarize</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.secondaryButton,
                loadingAction === 'summary' && styles.disabledButton
              ]} 
              onPress={handleGenerateQuestions}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'questions' ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.buttonText}>Generating...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="psychology" size={24} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Generate Questions</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // Results Section
        <View style={styles.resultContainer}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'summary' && styles.activeTab,
                !response.summary && styles.inactiveTab
              ]}
              onPress={() => {
                if (!response.summary && !loadingAction) {
                  handleSummarize();
                } else {
                  setActiveTab('summary');
                }
              }}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'summary' ? (
                <>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.tabText}>Summarizing...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="summarize" size={20} color={colors.text} />
                  <Text style={styles.tabText}>Summary</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'questions' && styles.activeTab,
                !response.questions && styles.inactiveTab
              ]}
              onPress={() => {
                if (!response.questions && !loadingAction) {
                  handleGenerateQuestions();
                } else {
                  setActiveTab('questions');
                }
              }}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'questions' ? (
                <>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.tabText}>Generating...</Text>
            </>
          ) : (
            <>
                  <MaterialIcons name="psychology" size={20} color={colors.text} />
                  <Text style={styles.tabText}>Questions</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.headerRow}>
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={handleReset}
            >
              <MaterialIcons name="refresh" size={20} color={colors.primary} />
              <Text style={styles.resetText}>Start Over</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.downloadButton,
                loadingAction && styles.disabledButton
              ]}
              onPress={handleDownloadPDF}
              disabled={loadingAction !== null}
            >
              <MaterialIcons name="file-download" size={20} color={colors.primary} />
              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContainer}>
            {activeTab === 'summary' && response.summary && (
              <Text style={styles.resultText}>{response.summary.data}</Text>
            )}
            {activeTab === 'questions' && response.questions && (
              <View style={styles.questionsContainer}>
                {response.questions.data.map((item, index) => (
                  <View key={index} style={styles.questionItem}>
                    <Text style={styles.questionNumber}>{index + 1}.</Text>
                    <Text style={styles.resultText}>{item}</Text>
                  </View>
                ))}
                  </View>
                )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
