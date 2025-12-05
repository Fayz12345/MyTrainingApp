import React from 'react';
import { Box, CircularProgress, Typography, Fade } from '@mui/material';

interface LoaderProps {
  message?: string;
  size?: number;
  fullHeight?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ 
  message = 'Loading...', 
  size = 60,
  fullHeight = false 
}) => {
  return (
    <Fade in={true} timeout={500}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4rem 2rem',
          minHeight: fullHeight ? '60vh' : 'auto',
          gap: 3,
          position: 'relative',
        }}
      >
        {/* Animated circular progress with gradient effect */}
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: size + 20,
              height: size + 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(156, 39, 176, 0.1) 100%)',
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': {
                  transform: 'translate(-50%, -50%) scale(1)',
                  opacity: 0.5,
                },
                '50%': {
                  transform: 'translate(-50%, -50%) scale(1.2)',
                  opacity: 0.3,
                },
              },
            },
          }}
        >
          <CircularProgress 
            size={size} 
            thickness={4.5}
            sx={{
              color: 'primary.main',
              animationDuration: '800ms',
              position: 'relative',
              zIndex: 1,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
                animation: 'circular-rotate 1.4s ease-in-out infinite',
              },
            }}
          />
        </Box>

        {/* Loading message with animated dots */}
        {message && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: 500,
                color: 'text.primary',
                fontSize: '1rem',
                letterSpacing: '0.02em',
              }}
            >
              {message}
            </Typography>
            {/* Animated dots */}
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                alignItems: 'center',
                mt: 0.5,
              }}
            >
              {[0, 1, 2].map((index) => (
                <Box
                  key={index}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    animation: 'bounce 1.4s ease-in-out infinite',
                    animationDelay: `${index * 0.2}s`,
                    '@keyframes bounce': {
                      '0%, 80%, 100%': {
                        transform: 'scale(0.8)',
                        opacity: 0.5,
                      },
                      '40%': {
                        transform: 'scale(1.2)',
                        opacity: 1,
                      },
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default Loader;

