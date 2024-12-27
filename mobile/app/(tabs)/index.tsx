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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ENV from '../../env';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '../../hooks/useThemeColor';

type ResponseType = {
  type: 'summary' | 'questions';
  data: string | string[];
  noteType?: string;
  key_terms?: string[];
  foreignTerms?: string[];
};

export default function HomeScreen() {
  const { colors } = useThemeColor();
  const [input, setInput] = useState<string>('');
  const [image, setImage] = useState<string | null>(null);
  const [response, setResponse] = useState<ResponseType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<'summary' | 'questions' | null>(null);

  // Image picker function
  const pickImage = async () => {
    try {
      // Check if running on web
      if (Platform.OS === 'web') {
        // Create an input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const imageUri = URL.createObjectURL(file);
            setImage(imageUri);
            handleExtractText(imageUri);
          }
        };
        // Trigger click
        input.click();
      } else {
        // Mobile image picker
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 1,
        });

        if (!result.canceled) {
          setImage(result.assets[0].uri);
          handleExtractText(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // API call for OCR and text extraction
  const handleExtractText = async (imageUri: string) => {
    setIsImageProcessing(true);
    setInput('');
    setResponse(null);

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
        mode: 'cors',
        credentials: 'omit',
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

    setLoadingAction('summary');
    setResponse(null);

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
      setResponse({ 
        type: 'summary', 
        data: data.summary,
        noteType: data.note_type,
        key_terms: data.key_terms 
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to process text. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  // API call for question generation
  const handleGenerateQuestions = async () => {
    if (!input) {
      Alert.alert('Error', 'Please enter or extract text first.');
      return;
    }

    setLoadingAction('questions');
    setResponse(null);

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
      console.log('Question generation response:', data); // Debug log

      setResponse({
        type: 'questions',
        data: data.questions,
        noteType: data.note_type,
        key_terms: data.key_terms, // Ensure this matches the API response
        foreignTerms: [] // Add this to match the type
      });
    } catch (error) {
      console.error('Question generation error:', error);
      Alert.alert('Error', 'Unable to generate questions. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    setResponse(null);
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
      backgroundColor: colors.surface,
      padding: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      flexDirection: 'row',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    inputIcon: {
      marginRight: 12,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    input: {
      flex: 1,
      minHeight: 120,
      color: colors.text,
      fontSize: 16,
      textAlignVertical: 'top',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    secondaryButton: {
      backgroundColor: colors.secondary,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    imageContainer: {
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#FFFFFF',
    },
    previewImage: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    resultContainer: {
      flex: 1,
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
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
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    questionItem: {
      flexDirection: 'row',
      marginBottom: 16,
      paddingRight: 8,
    },
    questionNumber: {
      color: colors.primary,
      fontWeight: '600',
      marginRight: 8,
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
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    processingText: {
      color: '#FFFFFF',
      marginTop: 8,
      fontSize: 16,
      fontWeight: '600',
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
      fontSize: 16,
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
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Study Helper</Text>

      <View style={styles.imageSection}>
        {!image ? (
          <TouchableOpacity 
            style={styles.uploadButton} 
            onPress={pickImage}
          >
            <MaterialIcons name="add-photo-alternate" size={32} color={colors.primary} />
            <Text style={styles.uploadText}>Pick an Image</Text>
          </TouchableOpacity>
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
                onPress={pickImage}
              >
                <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
                <Text style={styles.retakeText}>Pick New Image</Text>
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
          value={input}
          onChangeText={handleInputChange}
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

      {response && (
        <View style={styles.resultContainer}>
          {response.type === 'summary' ? (
            <ScrollView style={styles.scrollContainer}>
              <View style={styles.resultHeader}>
                <MaterialIcons name="article" size={24} color="#F54B64" />
                <Text style={styles.subtitle}>
                  {response.noteType ? `${response.noteType.charAt(0).toUpperCase() + response.noteType.slice(1)} Notes` : 'Summary'}
                </Text>
              </View>
              <Text style={styles.resultText}>{response.data as string}</Text>
              
              {response.key_terms && response.key_terms.length > 0 && (
                <View style={styles.keyTermsSection}>
                  <View style={styles.keyTermsHeader}>
                    <MaterialIcons name="translate" size={20} color="#F54B64" />
                    <Text style={styles.keyTermsTitle}>Key Terms</Text>
                  </View>
                  <View style={styles.termsContainer}>
                    {response.key_terms.map((term, index) => (
                      <View key={index} style={styles.termItem}>
                        <Text style={styles.termText}>{term}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView style={styles.scrollContainer}>
              <View style={styles.resultHeader}>
                <MaterialIcons 
                  name={response.noteType === "language" ? "school" : "quiz"} 
                  size={24} 
                  color="#F54B64" 
                />
                <Text style={styles.subtitle}>Generated Questions</Text>
              </View>

              <View style={styles.questionsContainer}>
                {(response.data as string[]).map((item, index) => (
                  <View key={index} style={styles.questionItem}>
                    <Text style={styles.questionNumber}>{index + 1}.</Text>
                    <Text style={styles.resultText}>{item}</Text>
                  </View>
                ))}
              </View>

              {response.key_terms && response.key_terms.length > 0 && (
                <View style={styles.keyTermsSection}>
                  <View style={styles.keyTermsHeader}>
                    <MaterialIcons name="translate" size={20} color="#F54B64" />
                    <Text style={styles.keyTermsTitle}>Key Terms</Text>
                  </View>
                  <View style={styles.termsContainer}>
                    {response.key_terms.map((term, index) => (
                      <View key={index} style={styles.termItem}>
                        <Text style={styles.termText}>{term}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
