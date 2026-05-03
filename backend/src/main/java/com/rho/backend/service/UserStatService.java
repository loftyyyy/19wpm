package com.rho.backend.service;

import com.rho.backend.repository.UserStatRepository;
import org.springframework.stereotype.Service;

@Service
public class UserStatService {

    private final UserStatRepository userStatRepository;

    public UserStatService(UserStatRepository userStatRepository){
        this.userStatRepository = userStatRepository;
    }




}
