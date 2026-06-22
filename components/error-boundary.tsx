import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught react exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Application Error Detected</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>
              {this.state.error?.message || "An unexpected error occurred."}
            </Text>
            {this.state.error?.stack ? (
              <Text style={styles.stack}>{this.state.error.stack}</Text>
            ) : null}
          </ScrollView>
          <View style={{ marginTop: 24, width: '100%' }}>
            <Button title="Retry / Reload" color="#FF6B4A" onPress={this.handleReset} />
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#07070B',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#FF6B4A',
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 400,
    width: '100%',
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  message: {
    fontSize: 15,
    color: '#F5F5FA',
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 20,
  },
  stack: {
    fontSize: 11,
    color: '#7A7A92',
    lineHeight: 16,
  },
});
