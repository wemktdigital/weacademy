import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#29CEDF',
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#29CEDF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 30,
  },
  certificateText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 1.5,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#29CEDF',
    marginBottom: 20,
    textDecoration: 'underline',
  },
  details: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    marginTop: 40,
    fontSize: 10,
    color: '#999999',
    textAlign: 'center',
  },
  qrPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#cccccc',
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

type CertificateProps = {
  userName: string
  issuedAt: string
  certificateId: string
}

export function CertificatePDF({ userName, issuedAt, certificateId }: CertificateProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          <Text style={styles.header}>WE Academy</Text>
          <Text style={styles.subtitle}>Laboratório de IA</Text>
          
          <Text style={styles.certificateText}>
            Certificamos que
          </Text>
          
          <Text style={styles.userName}>
            {userName}
          </Text>
          
          <Text style={styles.certificateText}>
            completou com sucesso o programa do Laboratório de IA,
            demonstrando proficiência no uso de ferramentas de inteligência artificial
            para aplicações médicas e de marketing.
          </Text>
          
          <Text style={styles.details}>
            Emitido em: {issuedAt}
          </Text>
          
          <Text style={styles.details}>
            ID: {certificateId}
          </Text>
          
          <View style={styles.qrPlaceholder}>
            <Text style={{ fontSize: 8, color: '#999999' }}>QR Code</Text>
          </View>
          
          <Text style={styles.footer}>
            Este certificado pode ser verificado em weacademy.com/certificados/{certificateId}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
