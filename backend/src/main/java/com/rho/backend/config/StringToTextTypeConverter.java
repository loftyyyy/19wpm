package com.rho.backend.config;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.fasterxml.jackson.databind.util.Converter;
import com.rho.backend.enums.TextType;
import org.springframework.stereotype.Component;



@Component
public class StringToTextTypeConverter implements Converter<String, TextType> {
    @Override
    public TextType convert(String source) {
        return TextType.valueOf(source.toUpperCase());
    }

    @Override
    public JavaType getInputType(TypeFactory typeFactory) {
        return null;
    }

    @Override
    public JavaType getOutputType(TypeFactory typeFactory) {
        return null;
    }
}

