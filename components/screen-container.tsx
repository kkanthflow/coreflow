import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
  safeAreaStyle?: StyleProp<ViewStyle>;
}

/**
 * Screen container with dynamic background from theme.
 * Handles safe area and ensures full-bleed background color.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  safeAreaStyle,
  style,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();

  return (
    <View
      className={cn("flex-1", containerClassName)}
      style={[{ backgroundColor: colors.background }, style]}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={safeAreaStyle}
      >
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
