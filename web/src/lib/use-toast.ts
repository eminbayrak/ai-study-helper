import { toast } from "../components/ui/use-toast"

export function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  toast({
    variant: type === 'error' ? 'destructive' : 'default',
    title: type.charAt(0).toUpperCase() + type.slice(1),
    description: message,
    duration: 3000,
  })
} 